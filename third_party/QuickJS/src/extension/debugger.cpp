#include "QuickJS/extension/debugger.h"

#include <assert.h>
#include <stdlib.h>
#include <string.h>
#include <sys/time.h>
#include <functional>

#include "QuickJS/extension/taro_js_type.h"
#include "../core/builtins/js-big-num.h"
#include "../core/object.h"
#include "../core/parser.h"
#include "../core/runtime.h"

#if QUICKJS_ENABLE_DEBUGGER

#ifdef ANDROID_PRINT
#include <android/log.h>
#define printf(...) __android_log_print(ANDROID_LOG_INFO, "QuickJS", __VA_ARGS__)
#endif

typedef struct DebuggerSuspendedState {
  uint32_t variable_reference_count;
  JSValue variable_references;
  JSValue variable_pointers;
  const uint8_t* cur_pc;
} DebuggerSuspendedState;

static int
convert_jsvalue_to_json(JSContext* ctx, JSValue value, char** str, int* len) {
  JSValue stringified =
      JS_JSONStringify(ctx, value, JS_UNDEFINED, JS_UNDEFINED);
  *str = const_cast<char*>(JS_ToCStringLen(ctx, (size_t*)len, stringified));
  JS_FreeValue(ctx, stringified);
  return 0;
}

static int js_transport_write_value(JSDebuggerInfo* info, JSValue value) {
  JSValue stringified =
      JS_JSONStringify(info->debugging_ctx, value, JS_UNDEFINED, JS_UNDEFINED);
  size_t len;
  const char* str = JS_ToCStringLen(info->debugging_ctx, &len, stringified);
  int ret = 0;
  if (len)
    ret = info->notify_fun(info->ctx, str, len, info->transport_udata);
  // else send error somewhere?
  JS_FreeCString(info->debugging_ctx, str);
  JS_FreeValue(info->debugging_ctx, stringified);
  JS_FreeValue(info->debugging_ctx, value);

  return ret;
}

static JSValue js_transport_new_envelope(
    JSDebuggerInfo* info,
    const char* type) {
  JSValue ret = JS_NewObject(info->debugging_ctx);
  JS_SetPropertyStr(
      info->debugging_ctx, ret, "type", JS_NewString(info->debugging_ctx, type));
  return ret;
}

static int js_transport_send_event(JSDebuggerInfo* info, JSValue event) {
  JSValue envelope = js_transport_new_envelope(info, "event");
  JS_SetPropertyStr(info->debugging_ctx, envelope, "event", event);
  return js_transport_write_value(info, envelope);
}

static int js_transport_send_response(
    JSDebuggerInfo* info,
    JSValue request,
    JSValue body,
    JSValue response) {
  JSContext* ctx = info->ctx;
  // JSValue envelope = js_transport_new_envelope(info, "response");
  JS_SetPropertyStr(
      info->ctx, response, "type", JS_NewString(info->ctx, "response"));

  JS_SetPropertyStr(ctx, response, "result", body);
  JS_SetPropertyStr(
      ctx,
      response,
      "request_seq",
      JS_GetPropertyStr(ctx, request, "request_seq"));
  return 1;
}

static JSValue js_get_scopes(JSContext* ctx, int frame) {
  // for now this is always the same.
  // global, local, closure. may change in the future. can check if closure is
  // empty.

  JSValue scopes = JS_NewArray(ctx);

  int scope_count = 0;

  JSValue local = JS_NewObject(ctx);
  JS_SetPropertyStr(ctx, local, "name", JS_NewString(ctx, "Local"));
  JS_SetPropertyStr(
      ctx, local, "reference", JS_NewInt32(ctx, (frame << 2) + 1));
  JS_SetPropertyStr(ctx, local, "expensive", JS_FALSE);
  JS_SetPropertyUint32(ctx, scopes, scope_count++, local);

  JSValue closure = JS_NewObject(ctx);
  JS_SetPropertyStr(ctx, closure, "name", JS_NewString(ctx, "Closure"));
  JS_SetPropertyStr(
      ctx, closure, "reference", JS_NewInt32(ctx, (frame << 2) + 2));
  JS_SetPropertyStr(ctx, closure, "expensive", JS_FALSE);
  JS_SetPropertyUint32(ctx, scopes, scope_count++, closure);

  JSValue global = JS_NewObject(ctx);
  JS_SetPropertyStr(ctx, global, "name", JS_NewString(ctx, "Global"));
  JS_SetPropertyStr(
      ctx, global, "reference", JS_NewInt32(ctx, (frame << 2) + 0));
  JS_SetPropertyStr(ctx, global, "expensive", JS_TRUE);
  JS_SetPropertyUint32(ctx, scopes, scope_count++, global);

  return scopes;
}

static void js_debugger_get_variable_type(
    JSContext* ctx,
    struct DebuggerSuspendedState* state,
    JSValue var,
    JSValue var_val) {
  // 0 means not expandible
  uint32_t reference = 0;
  if (taro_is_string(var_val))
    JS_SetPropertyStr(ctx, var, "type", JS_NewString(ctx, "string"));
  else if (tag_is_number(JS_VALUE_GET_NORM_TAG(var_val)))
    JS_SetPropertyStr(ctx, var, "type", JS_NewString(ctx, "number"));
  else if (taro_is_bool(var_val))
    JS_SetPropertyStr(ctx, var, "type", JS_NewString(ctx, "boolean"));
  else if (taro_is_null(var_val))
    JS_SetPropertyStr(ctx, var, "type", JS_NewString(ctx, "null"));
  else if (taro_is_undefined(var_val))
    JS_SetPropertyStr(ctx, var, "type", JS_NewString(ctx, "undefined"));
  else if (taro_is_object(var_val)) {
    JS_SetPropertyStr(ctx, var, "type", JS_NewString(ctx, "Object"));

    JSObject* p = JS_VALUE_GET_OBJ(var_val);
    // todo: xor the the two dwords to get a better hash?
    uint32_t pl = (uint32_t)(uint64_t)p;
    JSValue found = JS_GetPropertyUint32(ctx, state->variable_pointers, pl);
    if (taro_is_undefined(found)) {
      reference = state->variable_reference_count++;
      JS_SetPropertyUint32(
          ctx,
          state->variable_references,
          reference,
          JS_DupValue(ctx, var_val));
      JS_SetPropertyUint32(
          ctx, state->variable_pointers, pl, JS_NewInt32(ctx, reference));
    } else {
      JS_ToUint32(ctx, &reference, found);
    }
    JS_FreeValue(ctx, found);
    char tmp_str[64];
    snprintf(tmp_str, 64, "%d", reference);
    JS_SetPropertyStr(ctx, var, "objectId", JS_NewString(ctx, tmp_str));
  }
}

static void js_debugger_get_value(
    JSContext* ctx,
    JSValue var_val,
    JSValue var,
    const char* value_property) {
  // do not toString on Arrays, since that makes a giant string of all the
  // elements. todo: typed arrays?
  if (taro_is_array(ctx, var_val)) {
    JSValue length = JS_GetPropertyStr(ctx, var_val, "length");
    uint32_t len;
    JS_ToUint32(ctx, &len, length);
    JS_FreeValue(ctx, length);
    char lenBuf[64];
    sprintf(lenBuf, "Array (%d)", len);
    JS_SetPropertyStr(ctx, var, value_property, JS_NewString(ctx, lenBuf));
    JS_SetPropertyStr(ctx, var, "indexedVariables", JS_NewInt32(ctx, len));
  } else {
    if (taro_is_string(var_val) || taro_is_number(var_val))
      JS_SetPropertyStr(ctx, var, value_property, JS_ToString(ctx, var_val));
  }
}

static JSValue js_debugger_get_variable(
    JSContext* ctx,
    struct DebuggerSuspendedState* state,
    JSValue var_name,
    JSValue var_val) {
  JSValue var = JS_NewObject(ctx);
  JS_SetPropertyStr(ctx, var, "name", var_name);
  JSValue var_retvalue = JS_NewObject(ctx);
  js_debugger_get_value(ctx, var_val, var_retvalue, "value");
  js_debugger_get_variable_type(ctx, state, var_retvalue, var_val);
  JS_SetPropertyStr(ctx, var, "value", var_retvalue);
  return var;
}

static int js_debugger_get_frame(JSContext* ctx, JSValue args) {
  JSValue reference_property = JS_GetPropertyStr(ctx, args, "frameId");
  int frame;
  JS_ToInt32(ctx, &frame, reference_property);
  JS_FreeValue(ctx, reference_property);

  return frame;
}

// static void js_send_stopped_event(JSDebuggerInfo* info, const char* reason) {
//   JSContext* ctx = info->debugging_ctx;

//   JSValue event = JS_NewObject(ctx);
//   // better thread id?
//   JS_SetPropertyStr(ctx, event, "type", JS_NewString(ctx, "StoppedEvent"));
//   JS_SetPropertyStr(ctx, event, "reason", JS_NewString(ctx, reason));
//   int64_t id = (int64_t)info->ctx;
//   JS_SetPropertyStr(ctx, event, "thread", JS_NewInt64(ctx, id));
//   js_transport_send_event(info, event);
// }

void frameobj_to_str(int32_t frame_id, int32_t obj_id, char* str) {
  int32_t id = (frame_id << 8) | (0xFFFF & obj_id);
  sprintf(str, "%d", id);
}

static void js_send_resumed_event(JSDebuggerInfo* info) {
  JSContext* ctx = info->debugging_ctx;
  JSValue event = JS_NewObject(ctx);
  JS_SetPropertyStr(
      ctx, event, "method", JS_NewString(ctx, "Debugger.resumed"));

  js_transport_write_value(info, event);
}

static void js_send_paused_event(JSDebuggerInfo* info, const char* reason) {
  JSContext* ctx = info->debugging_ctx;
  JSValue event = JS_NewObject(ctx);
  JS_SetPropertyStr(ctx, event, "method", JS_NewString(ctx, "Debugger.paused"));
  JSValue params = JS_NewObject(ctx);
  JSValue callFrames = js_debugger_build_backtrace0(ctx, info->cur_pc, reason);
  JS_SetPropertyStr(ctx, params, "callFrames", callFrames);
  JS_SetPropertyStr(ctx, params, "reason", JS_NewString(ctx, reason));
  JS_SetPropertyStr(ctx, event, "params", params);

  js_transport_write_value(info, event);
}

static uint32_t
js_get_property_as_uint32(JSContext* ctx, JSValue obj, const char* property) {
  JSValue prop = JS_GetPropertyStr(ctx, obj, property);
  uint32_t ret;
  JS_ToUint32(ctx, &ret, prop);
  JS_FreeValue(ctx, prop);
  return ret;
}

static void js_get_variables(
    JSDebuggerInfo* info,
    struct DebuggerSuspendedState* state,
    JSValue request,
    JSValue response) {
  JSContext* ctx = info->ctx;
  JSValue args = JS_GetPropertyStr(ctx, request, "args");
  JSValue reference_property =
      JS_GetPropertyStr(ctx, args, "variablesReference");
  JS_FreeValue(ctx, args);
  uint32_t reference = -1;
  JS_ToUint32(ctx, &reference, reference_property);
  JS_FreeValue(ctx, reference_property);

  JSValue properties = JS_NewArray(ctx);

  JSValue variable =
      JS_GetPropertyUint32(ctx, state->variable_references, reference);
  int skip_proto = 0;
  // if the variable reference was not found,
  // then it must be a frame locals, frame closures, or the global
  if (taro_is_undefined(variable)) {
    skip_proto = 1;
    int frame = reference >> 8;
    int scope = reference % 256;

    JS_ASSERT_CONTEXT(ctx, frame < js_debugger_stack_depth(ctx));

    if (scope == 0)
      variable = JS_GetGlobalObject(ctx);
    else if (scope == 1)
      variable = js_debugger_local_variables(ctx, frame);
    else if (scope == 2)
      variable = js_debugger_closure_variables(ctx, frame);
    else
      JS_ASSERT_CONTEXT(ctx, 0);

    // need to dupe the variable, as it's used below as well.
    JS_SetPropertyUint32(
        ctx, state->variable_references, reference, JS_DupValue(ctx, variable));
  }

  JSPropertyEnum* tab_atom;
  uint32_t tab_atom_count;

  JSValue filter = JS_GetPropertyStr(ctx, args, "filter");
  if (!taro_is_undefined(filter)) {
    const char* filter_str = JS_ToCString(ctx, filter);
    JS_FreeValue(ctx, filter);
    // only index filtering is supported by this server.
    // name filtering exists in VS Code, but is not implemented here.
    int indexed = strcmp(filter_str, "indexed") == 0;
    JS_FreeCString(ctx, filter_str);
    if (!indexed)
      goto unfiltered;

    uint32_t start = js_get_property_as_uint32(ctx, args, "start");
    uint32_t count = js_get_property_as_uint32(ctx, args, "count");

    char name_buf[64];
    for (uint32_t i = 0; i < count; i++) {
      JSValue value = JS_GetPropertyUint32(ctx, variable, start + i);
      sprintf(name_buf, "%d", i);
      JSValue variable_json = js_debugger_get_variable(
          ctx, state, JS_NewString(ctx, name_buf), value);
      JS_FreeValue(ctx, value);
      JS_SetPropertyUint32(ctx, properties, i, variable_json);
    }
    goto done;
  }
unfiltered:

  if (!JS_GetOwnPropertyNames(
          ctx,
          &tab_atom,
          &tab_atom_count,
          variable,
          JS_GPN_STRING_MASK | JS_GPN_SYMBOL_MASK)) {
    int offset = 0;

    if (!skip_proto) {
      const JSValue proto = JS_GetPrototype(ctx, variable);
      if (!taro_is_exception(proto)) {
        JSValue variable_json = js_debugger_get_variable(
            ctx, state, JS_NewString(ctx, "__proto__"), proto);
        JS_FreeValue(ctx, proto);
        JS_SetPropertyUint32(ctx, properties, offset++, variable_json);
      } else {
        JS_FreeValue(ctx, proto);
      }
    }

    for (int i = 0; i < tab_atom_count; i++) {
      JSValue value = JS_GetProperty(ctx, variable, tab_atom[i].atom);
      JSValue variable_json = js_debugger_get_variable(
          ctx, state, JS_AtomToString(ctx, tab_atom[i].atom), value);
      JS_FreeValue(ctx, value);
      JS_SetPropertyUint32(ctx, properties, i + offset, variable_json);
    }

    JS_FreePropertyEnum(ctx, tab_atom, tab_atom_count);
  }

done:
  JS_FreeValue(ctx, variable);

  js_transport_send_response(info, request, properties, response);
}

static void js_process_request(
    JSDebuggerInfo* info,
    struct DebuggerSuspendedState* state,
    JSValue request,
    JSValue response) {
  JSContext* ctx = info->ctx;
  JSValue command_property = JS_GetPropertyStr(ctx, request, "command");
  const char* command = JS_ToCString(ctx, command_property);
  if (strcmp("continue", command) == 0) {
    js_send_resumed_event(info);
    info->stepping = JS_DEBUGGER_STEP_CONTINUE;
    info->step_over = js_debugger_current_location(ctx, state->cur_pc);
    info->step_depth = js_debugger_stack_depth(ctx);
    js_transport_send_response(info, request, JS_UNDEFINED, response);
    info->is_paused = 0;
  }
  if (strcmp("pause", command) == 0) {
    // js_transport_send_response(info, request, JS_UNDEFINED, response);
    js_send_paused_event(info, "pause");
    info->is_paused = 1;
  } else if (strcmp("next", command) == 0) {
    info->stepping = JS_DEBUGGER_STEP;
    info->step_over = js_debugger_current_location(ctx, state->cur_pc);
    info->step_depth = js_debugger_stack_depth(ctx);
    // js_transport_send_response(info, request, JS_UNDEFINED, response);
    info->is_paused = 0;
  } else if (strcmp("stepIn", command) == 0) {
    info->stepping = JS_DEBUGGER_STEP_IN;
    info->step_over = js_debugger_current_location(ctx, state->cur_pc);
    info->step_depth = js_debugger_stack_depth(ctx);
    js_transport_send_response(info, request, JS_UNDEFINED, response);
    info->is_paused = 0;
  } else if (strcmp("stepOut", command) == 0) {
    info->stepping = JS_DEBUGGER_STEP_OUT;
    info->step_over = js_debugger_current_location(ctx, state->cur_pc);
    info->step_depth = js_debugger_stack_depth(ctx);
    js_transport_send_response(info, request, JS_UNDEFINED, response);
    info->is_paused = 0;
  } else if (strcmp("evaluate", command) == 0) {
    JSValue args = JS_GetPropertyStr(ctx, request, "args");
    int frame = js_debugger_get_frame(ctx, args);
    JSValue expression = JS_GetPropertyStr(ctx, args, "expression");
    JS_FreeValue(ctx, args);
    JSValue result = js_debugger_evaluate(ctx, frame, expression);
    if (taro_is_exception(result)) {
      JS_FreeValue(ctx, result);
      result = JS_GetException(ctx);
    }
    JS_FreeValue(ctx, expression);

    JSValue body = JS_NewObject(ctx);
    js_debugger_get_value(ctx, result, body, "value");
    js_debugger_get_variable_type(ctx, state, body, result);
    JS_FreeValue(ctx, result);
    js_transport_send_response(info, request, body, response);
  } else if (strcmp("stackTrace", command) == 0) {
    JSValue stack_trace = js_debugger_build_backtrace(ctx, state->cur_pc);
    js_transport_send_response(info, request, stack_trace, response);
  } else if (strcmp("scopes", command) == 0) {
    JSValue args = JS_GetPropertyStr(ctx, request, "args");
    int frame = js_debugger_get_frame(ctx, args);
    JS_FreeValue(ctx, args);
    JSValue scopes = js_get_scopes(ctx, frame);
    js_transport_send_response(info, request, scopes, response);
  } else if (strcmp("variables", command) == 0) {
    JSValue args = JS_GetPropertyStr(ctx, request, "args");
    JSValue reference_property =
        JS_GetPropertyStr(ctx, args, "variablesReference");
    JS_FreeValue(ctx, args);
    uint32_t reference;
    JS_ToUint32(ctx, &reference, reference_property);
    JS_FreeValue(ctx, reference_property);

    JSValue properties = JS_NewArray(ctx);

    JSValue variable =
        JS_GetPropertyUint32(ctx, state->variable_references, reference);

    int skip_proto = 0;
    // if the variable reference was not found,
    // then it must be a frame locals, frame closures, or the global
    if (taro_is_undefined(variable)) {
      skip_proto = 1;
      int frame = reference >> 8;
      int scope = reference % 256;

      JS_ASSERT_CONTEXT(ctx, frame < js_debugger_stack_depth(ctx));

      if (scope == 0)
        variable = JS_GetGlobalObject(ctx);
      else if (scope == 1)
        variable = js_debugger_local_variables(ctx, frame);
      else if (scope == 2)
        variable = js_debugger_closure_variables(ctx, frame);
      else
        JS_ASSERT_CONTEXT(ctx, 0);

      // need to dupe the variable, as it's used below as well.
      JS_SetPropertyUint32(
          ctx,
          state->variable_references,
          reference,
          JS_DupValue(ctx, variable));
    }

    JSPropertyEnum* tab_atom;
    uint32_t tab_atom_count;

    JSValue filter = JS_GetPropertyStr(ctx, args, "filter");
    if (!taro_is_undefined(filter)) {
      const char* filter_str = JS_ToCString(ctx, filter);
      JS_FreeValue(ctx, filter);
      // only index filtering is supported by this server.
      // name filtering exists in VS Code, but is not implemented here.
      int indexed = strcmp(filter_str, "indexed") == 0;
      JS_FreeCString(ctx, filter_str);
      if (!indexed)
        goto unfiltered;

      uint32_t start = js_get_property_as_uint32(ctx, args, "start");
      uint32_t count = js_get_property_as_uint32(ctx, args, "count");

      char name_buf[64];
      for (uint32_t i = 0; i < count; i++) {
        JSValue value = JS_GetPropertyUint32(ctx, variable, start + i);
        sprintf(name_buf, "%d", i);
        JSValue variable_json = js_debugger_get_variable(
            ctx, state, JS_NewString(ctx, name_buf), value);
        JS_FreeValue(ctx, value);
        JS_SetPropertyUint32(ctx, properties, i, variable_json);
      }
      goto done;
    }

  unfiltered:

    if (!JS_GetOwnPropertyNames(
            ctx,
            &tab_atom,
            &tab_atom_count,
            variable,
            JS_GPN_STRING_MASK | JS_GPN_SYMBOL_MASK)) {
      int offset = 0;

      if (!skip_proto) {
        const JSValue proto = JS_GetPrototype(ctx, variable);
        if (!taro_is_exception(proto)) {
          JSValue variable_json = js_debugger_get_variable(
              ctx, state, JS_NewString(ctx, "__proto__"), proto);
          JS_FreeValue(ctx, proto);
          JS_SetPropertyUint32(ctx, properties, offset++, variable_json);
        } else {
          JS_FreeValue(ctx, proto);
        }
      }

      for (int i = 0; i < tab_atom_count; i++) {
        JSValue value = JS_GetProperty(ctx, variable, tab_atom[i].atom);
        JSValue variable_json = js_debugger_get_variable(
            ctx, state, JS_AtomToString(ctx, tab_atom[i].atom), value);
        JS_FreeValue(ctx, value);
        JS_SetPropertyUint32(ctx, properties, i + offset, variable_json);
      }

      JS_FreePropertyEnum(ctx, tab_atom, tab_atom_count);
    }

  done:
    JS_FreeValue(ctx, variable);

    js_transport_send_response(info, request, properties, response);
  } else if (strcmp("get_variables", command) == 0) {
    js_get_variables(info, state, request, response);
  }
  JS_FreeCString(ctx, command);
  JS_FreeValue(ctx, command_property);
  JS_FreeValue(ctx, request);
}

static void js_process_breakpoints(JSDebuggerInfo* info, JSValue message) {
  JSContext* ctx = info->ctx;

  // force all functions to reprocess their breakpoints.
  info->breakpoints_dirty_counter++;

  JSValue path_property = JS_GetPropertyStr(ctx, message, "path");
  const char* path = JS_ToCString(ctx, path_property);
  JSValue path_data = JS_GetPropertyStr(ctx, info->breakpoints, path);

  if (!taro_is_undefined(path_data))
    JS_FreeValue(ctx, path_data);
  // use an object to store the breakpoints as a sparse array, basically.
  // this will get resolved into a pc array mirror when its detected as dirty.
  path_data = JS_NewObject(ctx);
  JS_SetPropertyStr(ctx, info->breakpoints, path, path_data);
  JS_FreeCString(ctx, path);
  JS_FreeValue(ctx, path_property);

  JSValue breakpoints = JS_GetPropertyStr(ctx, message, "breakpoints");
  JS_SetPropertyStr(ctx, path_data, "breakpoints", breakpoints);
  JS_SetPropertyStr(
      ctx,
      path_data,
      "dirty",
      JS_NewInt32(ctx, info->breakpoints_dirty_counter));

  JS_FreeValue(ctx, message);
}

JSValue js_debugger_file_breakpoints(JSContext* ctx, const char* path) {
  JSDebuggerInfo* info = js_debugger_info(JS_GetRuntime(ctx));
  JSValue path_data = JS_GetPropertyStr(ctx, info->breakpoints, path);
  return path_data;
}

int js_handle_debugger_messages(
    JSContext* ctx,
    const char* req_body,
    int req_len,
    char** rsp_body,
    int* rsp_len) {
  JSDebuggerInfo* info = js_debugger_info(JS_GetRuntime(ctx));
//  js_send_resumed_event(info);
  info->ctx = ctx;
  uint8_t* cur_pc = info->cur_pc;
  struct DebuggerSuspendedState* state = info->suspend_state;
  if (!state) {
    state = (DebuggerSuspendedState*)malloc(sizeof(DebuggerSuspendedState));
    state->variable_reference_count = js_debugger_stack_depth(ctx) << 8;
    state->variable_pointers = JS_NewObject(ctx);
    state->variable_references = JS_NewObject(ctx);
    state->cur_pc = cur_pc;
    info->suspend_state = state;
  }
  // struct DebuggerSuspendedState state;
  // state.variable_reference_count = js_debugger_stack_depth(ctx) << 8;
  // state.variable_pointers = JS_NewObject(ctx);
  // state.variable_references = JS_NewObject(ctx);
  // state.cur_pc = cur_pc;
  JSValue js_resp = JS_NewObject(ctx);

  JSValue message = JS_ParseJSON(ctx, req_body, req_len, "<debugger>");
  JSValue vtype = JS_GetPropertyStr(ctx, message, "type");
  const char* type = JS_ToCString(ctx, vtype);
  if (strcmp("request", type) == 0) {
    js_process_request(
        info, state, JS_GetPropertyStr(ctx, message, "request"), js_resp);
    // done_processing = 1;
  } else if (strcmp("continue", type) == 0) {
    info->is_paused = 0;
    js_send_resumed_event(info);
  } else if (strcmp("breakpoints", type) == 0) {
    js_process_breakpoints(
        info, JS_GetPropertyStr(ctx, message, "breakpoints"));
  } else if (strcmp("stopOnException", type) == 0) {
    JSValue stop = JS_GetPropertyStr(ctx, message, "stopOnException");
    info->exception_breakpoint = JS_ToBool(ctx, stop);
    JS_FreeValue(ctx, stop);
  }
  JS_FreeCString(ctx, type);
  JS_FreeValue(ctx, vtype);
  JS_FreeValue(ctx, message);
  int ret = 1;

  if (info->is_paused == 0) {
    JS_FreeValue(ctx, state->variable_references);
    JS_FreeValue(ctx, state->variable_pointers);
    free(state);
    info->suspend_state = NULL;
  }
  convert_jsvalue_to_json(ctx, js_resp, rsp_body, rsp_len);
  JS_FreeValue(ctx, js_resp);
  return ret;
}

// 1: 成功处理消息 0：无消息 -1：出错
static int js_process_debugger_messages(
    JSDebuggerInfo* info,
    const uint8_t* cur_pc) {
  //  info->interrupt_call(info->ctx, info->transport_udata, -1);

  //  return 1;
  int ret = 0;
  do {
      if (info->interrupt_call == nullptr) {
          break;
      }
    ret = info->interrupt_call(info->ctx, info->transport_udata, 20);
  } while (info->is_paused);
  return ret;
}

void js_debugger_exception(JSContext* ctx) {
  JSDebuggerInfo* info = js_debugger_info(JS_GetRuntime(ctx));
  if (!info->exception_breakpoint)
    return;
  if (info->is_debugging)
    return;
  info->is_debugging = 1;
  info->ctx = ctx;
  js_send_paused_event(info, "exception");
  info->is_paused = 1;
  js_process_debugger_messages(info, NULL);
  info->is_debugging = 0;
  info->ctx = NULL;
}

static void js_debugger_context_event(
    JSContext* caller_ctx,
    const char* reason) {
  if (!js_debugger_is_transport_connected(JS_GetRuntime(caller_ctx)))
    return;

  JSDebuggerInfo* info = js_debugger_info(JS_GetRuntime(caller_ctx));
  if (info->debugging_ctx == caller_ctx)
    return;

  JSContext* ctx = info->debugging_ctx;

  JSValue event = JS_NewObject(ctx);
  // better thread id?
  JS_SetPropertyStr(ctx, event, "type", JS_NewString(ctx, "ThreadEvent"));
  JS_SetPropertyStr(ctx, event, "reason", JS_NewString(ctx, reason));
  JS_SetPropertyStr(
      ctx, event, "thread", JS_NewInt64(ctx, (int64_t)caller_ctx));
  js_transport_send_event(info, event);
}

void js_debugger_new_context(JSContext* ctx) {
  js_debugger_context_event(ctx, "new");
}

void js_debugger_free_context(JSContext* ctx) {
  js_debugger_context_event(ctx, "exited");
}

// in thread x request/response of pending commands.
// todo: background thread that reads the socket.
void js_debugger_check(JSContext* ctx, uint8_t* cur_pc, int debugger_flag) {
  JSDebuggerInfo* info = js_debugger_info(JS_GetRuntime(ctx));
  info->cur_pc = cur_pc;
  if (info->is_debugging)
    return;
  if (info->debugging_ctx == ctx)
    return;
  info->is_debugging = 1;
  info->ctx = ctx;

  if (!info->attempted_connect) {
    info->attempted_connect = 1;
  } else if (!info->attempted_wait) {
    info->attempted_wait = 1;
  }

  if (info->notify_fun == NULL)
    goto done;

  struct JSDebuggerLocation location;
  int depth;

  // perform stepping checks prior to the breakpoint check
  // as those need to preempt breakpoint behavior to skip their last
  // position, which may be a breakpoint.
  if (info->stepping) {
    // all step operations need to ignore their step location, as those
    // may be on a breakpoint.
    location = js_debugger_current_location(ctx, cur_pc);
    depth = js_debugger_stack_depth(ctx);
    if (info->step_depth == depth &&
        location.filename == info->step_over.filename &&
        location.line == info->step_over.line &&
        location.column == info->step_over.column)
      goto done;
  }

  if (js_debugger_check_breakpoint(
          ctx, info->breakpoints_dirty_counter, cur_pc) ||
      debugger_flag == 1) {
    // reaching a breakpoint resets any existing stepping.
    info->stepping = 0;
    info->is_paused = 1;
    js_send_paused_event(info, "breakpoint");
  } else if (info->stepping) {
    if (info->stepping == JS_DEBUGGER_STEP_CONTINUE) {
      // continue needs to proceed over the existing statement (which may be
      // multiple ops) once any change in location is detecting, turn off
      // stepping. since reaching here after performing the check above, that is
      // in fact the case. turn off stepping.
      info->stepping = 0;
    } else if (info->stepping == JS_DEBUGGER_STEP_IN) {
      int depth = js_debugger_stack_depth(ctx);
      // break if the stack is deeper
      // or
      // break if the depth is the same, but the location has changed
      // or
      // break if the stack unwinds
      if (info->step_depth == depth) {
        struct JSDebuggerLocation location =
            js_debugger_current_location(ctx, cur_pc);
        if (location.filename == info->step_over.filename &&
            location.line == info->step_over.line &&
            location.column == info->step_over.column)
          goto done;
      }
      info->stepping = 0;
      info->is_paused = 1;
      js_send_paused_event(info, "step");
    } else if (info->stepping == JS_DEBUGGER_STEP_OUT) {
      int depth = js_debugger_stack_depth(ctx);
      if (depth >= info->step_depth)
        goto done;
      info->stepping = 0;
      info->is_paused = 1;
      js_send_paused_event(info, "step");
    } else if (info->stepping == JS_DEBUGGER_STEP) {
      struct JSDebuggerLocation location =
          js_debugger_current_location(ctx, cur_pc);
      // to step over, need to make sure the location changes,
      // and that the location change isn't into a function call (deeper stack).
      if ((location.filename == info->step_over.filename &&
           location.line == info->step_over.line &&
           location.column == info->step_over.column) ||
          js_debugger_stack_depth(ctx) > info->step_depth)
        goto done;
      info->stepping = 0;
      info->is_paused = 1;
      js_send_paused_event(info, "step");
    } else {
      // ???
      info->stepping = 0;
    }
  }

  // if not paused, we ought to peek at the stream
  // and read it without blocking until all data is consumed.
  if (!info->is_paused) {
    // only peek at the stream every now and then.
    if (info->peek_ticks++ < 10000 && !info->should_peek)
      goto done;

    info->peek_ticks = 0;
    info->should_peek = 0;

    // continue peek/reading until there's nothing left.
    // breakpoints may arrive outside of a debugger pause.
    // once paused, fall through to handle the pause.
    while (!info->is_paused) {
      int peek = js_process_debugger_messages(info, cur_pc);
      if (peek < 0)
        goto fail;
      else if (peek == 0)
        goto done;
    }
  }

  if (js_process_debugger_messages(info, cur_pc) >= 0)
    goto done;

fail:
  js_debugger_free(JS_GetRuntime(ctx), info);
done:
  info->is_debugging = 0;
  info->ctx = NULL;
}

void js_debugger_free(JSRuntime* rt, JSDebuggerInfo* info) {
  if (!info->notify_fun)
    return;

  // don't use the JSContext because it might be in a funky state during
  // teardown. const char* terminated =
  // "{\"type\":\"event\",\"event\":{\"type\":\"terminated\"}}";

  // todo: send message
  // info->notify_fun(info->ctx, terminated, strlen(terminated),
  // info->transport_udata);
  info->interrupt_call = NULL;
  info->notify_fun = NULL;

  if (info->message_buffer) {
    js_free_rt(rt, info->message_buffer);
    info->message_buffer = NULL;
    info->message_buffer_length = 0;
  }

  JS_FreeValue(info->debugging_ctx, info->breakpoints);
  info->breakpoints = JS_NULL;

  JS_FreeContext(info->debugging_ctx);
  info->debugging_ctx = NULL;
}

void js_debugger_terminal(JSContext* ctx) {
  JSDebuggerInfo* info = js_debugger_info(JS_GetRuntime(ctx));
  js_debugger_free(JS_GetRuntime(ctx), info);
  info->is_paused = 0;
  info->stepping = 0;
}

int js_debugger_attach_funs(
    JSContext* ctx,
    InterruptCallFun aysnc_call,
    NotifyEventFun event_call,
    void* udata) {
  JSRuntime* rt = JS_GetRuntime(ctx);
  JSDebuggerInfo* info = js_debugger_info(rt);
  js_debugger_free(rt, info);
  info->debugging_ctx = JS_NewContext(rt);
  info->interrupt_call = aysnc_call;
  info->notify_fun = event_call;
  info->transport_udata = udata;

  JSContext* original_ctx = info->ctx;
  info->ctx = ctx;

  //    js_send_paused_event(info, "entry");

//  info->breakpoints = JS_NewObject(info->debugging_ctx);
  info->breakpoints = JS_NewObject(ctx);
  info->is_paused = 0;

  //    js_process_debugger_messages(info, NULL);

  info->ctx = original_ctx;
  return 1;
}

int js_debugger_is_transport_connected(JSRuntime* rt) {
  return js_debugger_info(rt)->notify_fun != NULL;
}

void js_debugger_cooperate(JSContext* ctx) {
  js_debugger_info(JS_GetRuntime(ctx))->should_peek = 1;
}

int js_debugger_set_mode(JSContext* ctx, int mode, const char* address) {
  // JSDebuggerInfo *info = js_debugger_info(JS_GetRuntime(ctx));
  // if (info->is_debugging || mode == 0) {
  //     return 0;
  // }

  // info->is_debugging = 1;
  // info->ctx = ctx;

  // if (mode == 1) {
  //     info->attempted_connect = 1;
  //     if (address != NULL && !info->transport_close)
  //         js_debugger_connect(ctx, address);
  // }
  // else if (mode == 2) {
  //     info->attempted_wait = 1;
  //     if (address != NULL && !info->transport_close)
  //         js_debugger_wait_connection(ctx, address);
  // }

  // if (info->transport_close == NULL)
  //     goto done;
  // done:
  //     info->is_debugging = 0;
  //     info->ctx = NULL;
  return 0;
}

int js_debugger_add_breakpoint(
    JSContext* ctx,
    const char* path,
    int line,
    int column,
    int breakpoint_id) {
  JSDebuggerInfo* info = js_debugger_info(JS_GetRuntime(ctx));
  info->ctx = ctx;

  // force all functions to reprocess their breakpoints.
  info->breakpoints_dirty_counter++;
  info->next_breakpoint_id++;

  JSValue breakpoint = JS_NewObject(ctx);
  JS_SetPropertyStr(ctx, breakpoint, "line", JS_NewInt32(ctx, line));
  JS_SetPropertyStr(ctx, breakpoint, "column", JS_NewInt32(ctx, column));
  // JS_SetPropertyStr(ctx, breakpoint, "breakpoint_id", JS_NewInt32(ctx,
  // info->next_breakpoint_id));
  JS_SetPropertyStr(
      ctx, breakpoint, "breakpoint_id", JS_NewInt32(ctx, breakpoint_id));

  JSValue new_path_data = JS_NewObject(ctx);
  JSValue new_breakpoints = JS_NewArray(ctx);
  int new_index = 0;
  int has_insert = 0;
  JSValue old_path_data = JS_GetPropertyStr(ctx, info->breakpoints, path);
  if (!taro_is_undefined(old_path_data)) {
    JSValue old_breakpoints =
        JS_GetPropertyStr(ctx, old_path_data, "breakpoints");
    if (!taro_is_undefined(old_breakpoints)) {
      JSValue old_length = JS_GetPropertyStr(ctx, old_breakpoints, "length");
      uint32_t old_len = 0;
      JS_ToUint32(ctx, &old_len, old_length);
      JS_FreeValue(ctx, old_length);
      for (uint32_t i = 0; i < old_len; i++) {
        JSValue old_breakpoint = JS_GetPropertyUint32(ctx, old_breakpoints, i);
        JSValue old_line = JS_GetPropertyStr(ctx, old_breakpoint, "line");
        uint32_t old_line_int = 0;
        JS_ToUint32(ctx, &old_line_int, old_line);
        JS_FreeValue(ctx, old_line);
        JSValue old_column = JS_GetPropertyStr(ctx, old_breakpoint, "column");
        uint32_t old_column_int = 0;
        JS_ToUint32(ctx, &old_column_int, old_column);
        JS_FreeValue(ctx, old_column);
        // 由小到大插入
        if (!has_insert &&
            (line < old_line_int ||
             (line == old_line_int && column <= old_column_int))) {
          has_insert = 1;
          JS_SetPropertyUint32(ctx, new_breakpoints, new_index++, breakpoint);
        }

        // 相同的去处旧断点
        if (line != old_line_int || column != old_column_int) {
          JS_SetPropertyUint32(
              ctx, new_breakpoints, new_index++, old_breakpoint);
        } else {
          JS_FreeValue(ctx, old_breakpoint);
        }
      }
    }
    JS_FreeValue(ctx, old_breakpoints);
  }
  JS_FreeValue(ctx, old_path_data);
  if (!has_insert) {
    JS_SetPropertyUint32(ctx, new_breakpoints, new_index, breakpoint);
  }

  JS_SetPropertyStr(ctx, new_path_data, "breakpoints", new_breakpoints);
  JS_SetPropertyStr(
      ctx,
      new_path_data,
      "dirty",
      JS_NewInt32(ctx, info->breakpoints_dirty_counter));
  JS_SetPropertyStr(ctx, info->breakpoints, path, new_path_data);

  return breakpoint_id;
}

void js_debugger_remove_breakpoint(JSContext* ctx, int breakpoint_id) {
  // find path by breakpoint_id
  JSDebuggerInfo* info = js_debugger_info(JS_GetRuntime(ctx));
  JSPropertyEnum* paths = NULL;
  uint32_t path_count = 0;

  if (JS_GetOwnPropertyNames(
          ctx, &paths, &path_count, info->breakpoints, JS_GPN_STRING_MASK) <
      0) {
    return;
  }
  JSAtom find_path_name = JS_ATOM_NULL;
  for (uint32_t i = 0; i < path_count && find_path_name == JS_ATOM_NULL; i++) {
    JSAtom path_atom = paths[i].atom;
    JSValue path_value = JS_GetProperty(ctx, info->breakpoints, path_atom);
    if (taro_is_object(path_value)) {
      JSValue breakpoints = JS_GetPropertyStr(ctx, path_value, "breakpoints");
      JSValue length = JS_GetPropertyStr(ctx, breakpoints, "length");
      uint32_t len = 0;
      JS_ToUint32(ctx, &len, length);
      JS_FreeValue(ctx, length);
      for (uint32_t idx = 0; idx < len && find_path_name == JS_ATOM_NULL;
           idx++) {
        JSValue breakpoint = JS_GetPropertyUint32(ctx, breakpoints, idx);
        JSValue break_id = JS_GetPropertyStr(ctx, breakpoint, "breakpoint_id");
        if (taro_is_number(break_id)) {
          int32_t break_id_int = 0;
          JS_ToInt32(ctx, &break_id_int, break_id);
          if (break_id_int == breakpoint_id) {
            find_path_name = JS_DupAtom(ctx, path_atom);
          }
        }
        JS_FreeValue(ctx, break_id);
        JS_FreeValue(ctx, breakpoint);
      }
      JS_FreeValue(ctx, breakpoints);
    }
    JS_FreeValue(ctx, path_value);
  }

  // 释放属性名的内存
  for (uint32_t i = 0; i < path_count; i++) {
    JS_FreeAtom(ctx, paths[i].atom);
  }
  js_free(ctx, paths);
  if (find_path_name != JS_ATOM_NULL) {
    const char* path_name = JS_AtomToCString(ctx, find_path_name);
    js_debugger_remove_breakpoint_by_path(ctx, path_name, breakpoint_id);
    JS_FreeCString(ctx, path_name);
  }
  JS_FreeAtom(ctx, find_path_name);
  return;
}

void js_debugger_remove_breakpoint_by_path(
    JSContext* ctx,
    const char* path,
    int breakpoint_id) {
  JSDebuggerInfo* info = js_debugger_info(JS_GetRuntime(ctx));
  JSValue path_data = JS_GetPropertyStr(ctx, info->breakpoints, path);
  if (taro_is_undefined(path_data)) {
    JS_FreeValue(ctx, path_data);
    return;
  }
  JSValue breakpoints = JS_GetPropertyStr(ctx, path_data, "breakpoints");
  if (taro_is_undefined(breakpoints)) {
    JS_FreeValue(ctx, breakpoints);
    JS_FreeValue(ctx, path_data);
    return;
  }

  JSValue length = JS_GetPropertyStr(ctx, breakpoints, "length");
  uint32_t len = 0;
  JS_ToUint32(ctx, &len, length);
  JS_FreeValue(ctx, length);

  JSValue new_breakpoints = JS_NewArray(ctx);
  int idx_array = 0;
  for (int i = 0; i < len; i++) {
    JSValue breakpoint = JS_GetPropertyUint32(ctx, breakpoints, i);
    JSValue id_value = JS_GetPropertyStr(ctx, breakpoint, "breakpoint_id");
    int32_t id = 0;
    JS_ToInt32(ctx, &id, id_value);
    if (id != breakpoint_id) {
      JS_SetPropertyUint32(
          ctx, new_breakpoints, idx_array++, JS_DupValue(ctx, breakpoint));
    }
    JS_FreeValue(ctx, id_value);
    JS_FreeValue(ctx, breakpoint);
  }

  info->breakpoints_dirty_counter++;
  JS_SetPropertyStr(ctx, path_data, "dirty", JS_NewInt32(ctx, info->breakpoints_dirty_counter));

  JS_SetPropertyStr(ctx, path_data, "breakpoints", new_breakpoints);
  JS_FreeValue(ctx, breakpoints);
  JS_FreeValue(ctx, path_data);
}

JSValue js_debugger_get_breakpoint(JSContext* ctx, char* path, int break_id) {
  JSDebuggerInfo* info = js_debugger_info(JS_GetRuntime(ctx));
  JSValue path_data = JS_GetPropertyStr(ctx, info->breakpoints, path);
  if (taro_is_undefined(path_data)) {
    JS_FreeValue(ctx, path_data);
    return JS_NULL;
  }
  JSValue breakpoints = JS_GetPropertyStr(ctx, path_data, "breakpoints");
  if (taro_is_undefined(breakpoints)) {
    JS_FreeValue(ctx, breakpoints);
    JS_FreeValue(ctx, path_data);
    return JS_NULL;
  }
  JS_FreeValue(ctx, path_data);

  JSValue length = JS_GetPropertyStr(ctx, breakpoints, "length");
  uint32_t len = 0;
  JS_ToUint32(ctx, &len, length);
  JS_FreeValue(ctx, length);
  for (int i = 0; i < len; i++) {
    JSValue breakpoint = JS_GetPropertyUint32(ctx, breakpoints, i);
    JSValue id_value = JS_GetPropertyStr(ctx, breakpoint, "id");
    uint32_t id = 0;
    JS_ToUint32(ctx, &id, id_value);
    JS_FreeValue(ctx, id_value);
    if (id == break_id) {
      JS_FreeValue(ctx, breakpoints);
      return breakpoint;
    }
    JS_FreeValue(ctx, breakpoint);
  }

  JS_FreeValue(ctx, breakpoints);

  return JS_NULL;
}

static int64_t js_debugger_current_ms() {
  struct timeval tv;
  gettimeofday(&tv, NULL);

  // 将秒和微秒转换为毫秒
  return tv.tv_sec * 1000 + tv.tv_usec / 1000;
}

void js_debugger_push_log_to_front_page(
    JSContext* context,
    const char* log_str) {
  JSDebuggerInfo* info = js_debugger_info(JS_GetRuntime(context));
  if (!info || !info->notify_fun) {
    return;
  }
  info->ctx = context;
  JSContext* ctx = info->debugging_ctx;
  JSValue event = JS_NewObject(ctx);
  JS_SetPropertyStr(
      ctx, event, "method", JS_NewString(ctx, "Runtime.consoleAPICalled"));
  JSValue params = JS_NewObject(ctx);
  // stackTrace
  JSValue stackTrace = JS_NewObject(ctx);
  JSValue callFrames = js_debugger_build_backtrace1(context, info->cur_pc);
  JS_SetPropertyStr(ctx, stackTrace, "callFrames", callFrames);
  JS_SetPropertyStr(ctx, params, "stackTrace", stackTrace);

  // args
  JSValue args = JS_NewArray(ctx);
  JSValue arg = JS_NewObject(ctx);
  JS_SetPropertyStr(ctx, arg, "type", JS_NewString(ctx, "string"));
  JS_SetPropertyStr(ctx, arg, "value", JS_NewString(ctx, log_str));
  JS_SetPropertyUint32(ctx, args, 0, arg);
  JS_SetPropertyStr(ctx, params, "args", args);

  // type
  JS_SetPropertyStr(ctx, params, "type", JS_NewString(ctx, "log"));
  // timestamp
  JS_SetPropertyStr(
      ctx, params, "timestamp", JS_NewInt64(ctx, js_debugger_current_ms()));
  JS_SetPropertyStr(ctx, event, "params", params);

  js_transport_write_value(info, event);
}

void js_debugger_report_load_event(JSContext* context, const char* filename) {
  JSDebuggerInfo* info = js_debugger_info(JS_GetRuntime(context));
  if (!info || !info->notify_fun) {
    return;
  }
  JSContext* ctx = info->debugging_ctx;
  JSValue event = JS_NewObject(ctx);
  JS_SetPropertyStr(
      ctx, event, "innerEvent", JS_NewString(ctx, "Inner.fileLoad"));
  JS_SetPropertyStr(ctx, event, "filename", JS_NewString(ctx, filename));

  js_transport_write_value(info, event);
}

static bool filter_opcode(uint8_t opcode) {
  return true;
  switch (opcode) {
      case OP_invalid:
      // 简单的栈操作 - 跳过
      case OP_push_i32:
      case OP_push_const:
      case OP_fclosure:
      case OP_push_atom_value:
      case OP_private_symbol:
      case OP_undefined:
      case OP_null:
      case OP_push_this:
      case OP_push_false:
      case OP_push_true:
      case OP_object:
      case OP_special_object:
      case OP_rest:

      // 简单栈操作
      case OP_drop:
      case OP_nip:
      case OP_nip1:
      case OP_dup:
      case OP_dup1:
      case OP_dup2:
      case OP_dup3:
      case OP_insert2:
      case OP_insert3:
      case OP_insert4:
      case OP_perm3:
      case OP_perm4:
      case OP_perm5:
      case OP_swap:
      case OP_swap2:
      case OP_rot3l:
      case OP_rot3r:
      case OP_rot4l:
      case OP_rot5l:

      // 类型转换 - 跳过
      case OP_to_object:
      case OP_to_propkey:
      // NOP操作 - 跳过
      case OP_nop:

      // 跳过的操作码：SHORT_OPCODES
#if SHORT_OPCODES
      case OP_push_minus1:
      case OP_push_0:
      case OP_push_1:
      case OP_push_2:
      case OP_push_3:
      case OP_push_4:
      case OP_push_5:
      case OP_push_6:
      case OP_push_7:
      case OP_push_i8:
      case OP_push_i16:
      case OP_push_const8:
      case OP_fclosure8:
      case OP_push_empty_string:
      case OP_get_loc0:
      case OP_get_loc1:
      case OP_get_loc2:
      case OP_get_loc3:
      case OP_put_loc0:
      case OP_put_loc1:
      case OP_put_loc2:
      case OP_put_loc3:
      case OP_set_loc0:
      case OP_set_loc1:
      case OP_set_loc2:
      case OP_set_loc3:
      case OP_get_arg0:
      case OP_get_arg1:
      case OP_get_arg2:
      case OP_get_arg3:
      case OP_put_arg0:
      case OP_put_arg1:
      case OP_put_arg2:
      case OP_put_arg3:
      case OP_set_arg0:
      case OP_set_arg1:
      case OP_set_arg2:
      case OP_set_arg3:
      case OP_get_var_ref0:
      case OP_get_var_ref1:
      case OP_get_var_ref2:
      case OP_get_var_ref3:
      case OP_put_var_ref0:
      case OP_put_var_ref1:
      case OP_put_var_ref2:
      case OP_put_var_ref3:
      case OP_set_var_ref0:
      case OP_set_var_ref1:
      case OP_set_var_ref2:
      case OP_set_var_ref3:
#endif
          return false;

      default:
          return true;
  }
}

JSDebuggerLocation js_debugger_current_location(
    JSContext* ctx,
    const uint8_t* cur_pc) {
	JSDebuggerLocation location;
  location.filename = 0;
  location.line = 0;
  location.column = 0;
  JSStackFrame* sf = ctx->rt->current_stack_frame;
  if (!sf)
    return location;

  JSObject* p = JS_VALUE_GET_OBJ(sf->cur_func);
  if (!p)
    return location;

  JSFunctionBytecode* b = p->u.func.function_bytecode;
  if (!b || !b->has_debug)
    return location;

  int pc = (cur_pc ? cur_pc : sf->cur_pc) - b->byte_code_buf - 1;
  uint8_t opcode;
  int line_num, col_num;
  while (pc >=0 && pc < b->byte_code_len - 1) {
    opcode = b->byte_code_buf[pc];
    line_num = find_line_num(ctx, b, pc, &col_num);
    if (filter_opcode(opcode) && location.line != line_num && location.column != col_num) {
      break;
    }
    pc++;
  }

  location.filename = b->debug.filename;
  location.line = line_num;
  location.column = col_num;
  // printf("taro-debugger js_debugger_current_location pc=%d opcode=%d line_num=%d col_num=%d %d\n", pc, opcode, location.line, location.column, OP_get_array_el);
  return location;
}

JSDebuggerInfo* js_debugger_info(JSRuntime* rt) {
  return &rt->debugger_info;
}

uint32_t js_debugger_stack_depth(JSContext* ctx) {
  uint32_t stack_index = 0;
  JSStackFrame* sf = ctx->rt->current_stack_frame;
  while (sf != NULL) {
    sf = sf->prev_frame;
    stack_index++;
  }
  return stack_index;
}

JSValue js_debugger_build_backtrace0(JSContext* ctx, const uint8_t* cur_pc, const char* reason) {
  JSValue callFrames = JS_NewArray(ctx);
  // fill callFrames with frame info
  uint32_t stack_index = 0;

  for (JSStackFrame* sf = ctx->rt->current_stack_frame; sf != NULL;
       sf = sf->prev_frame) {
    uint32_t callFrameId = stack_index++;
    char callFrameIdStr[32];
    snprintf(callFrameIdStr, 32, "%u", callFrameId);
    JSValue callFrame = JS_NewObject(ctx);
    JS_SetPropertyStr(
        ctx, callFrame, "callFrameId", JS_NewString(ctx, callFrameIdStr));
    // function name
    const char* func_name_str = get_func_name(ctx, sf->cur_func);
    if (!func_name_str || func_name_str[0] == '\0')
      JS_SetPropertyStr(
          ctx, callFrame, "functionName", JS_NewString(ctx, "<anonymous>"));
    else
      JS_SetPropertyStr(
          ctx, callFrame, "functionName", JS_NewString(ctx, func_name_str));
    JS_FreeCString(ctx, func_name_str);
    // location
    int closure_scope_count = 0;
    JSValue location = JS_NewObject(ctx);
    {
      JSObject* p = JS_VALUE_GET_OBJ(sf->cur_func);
      if (p && js_class_has_bytecode(p->class_id)) {
        JSFunctionBytecode* b = p->u.func.function_bytecode;
        closure_scope_count = b->closure_var_count;
        if (b->has_debug) {
          const uint8_t* pc = sf != ctx->rt->current_stack_frame || !cur_pc
              ? sf->cur_pc
              : cur_pc;
          int line_num1, col_num1;
          line_num1 = find_line_num(ctx, b, pc - b->byte_code_buf - 1, &col_num1);
          JS_SetPropertyStr(
              ctx,
              location,
              "filename",
              JS_AtomToString(ctx, b->debug.filename));
          char str_tmp[64];
          snprintf(str_tmp, 64, "%d", b->debug.filename);
          JS_SetPropertyStr(
              ctx, location, "scriptId", JS_NewString(ctx, str_tmp));
          if (line_num1 != -1) {
            JS_SetPropertyStr(
                ctx, location, "lineNumber", JS_NewUint32(ctx, line_num1 - 1));
//            if (strcmp(reason, "breakpoint") != 0)
              JS_SetPropertyStr(
                  ctx, location, "columnNumber", JS_NewUint32(ctx, col_num1 - 1));
          }
        }
      } else {
        JS_SetPropertyStr(
            ctx, callFrame, "functionName", JS_NewString(ctx, "(native)"));
      }
    }
    JS_SetPropertyStr(ctx, callFrame, "location", location);

    // scopeChain
    JS_SetPropertyStr(
        ctx,
        callFrame,
        "extScopeCount",
        JS_NewInt32(ctx, closure_scope_count + 1));
    // this
    JSValue thisVal = JS_NewObject(ctx);
    {
      // Todo: fill this
      // "className": "Object",
      // "description": "Object",
      // "objectId": "5",
      // "type": "object" undefined
      JS_SetPropertyStr(ctx, thisVal, "type", JS_NewString(ctx, "undefined"));
      // JS_SetPropertyStr(ctx, thisVal, "className", JS_NewString(ctx,
      // "Object")); JS_SetPropertyStr(ctx, thisVal, "description",
      // JS_NewString(ctx, "Object")); JS_SetPropertyStr(ctx, thisVal,
      // "objectId", JS_NewString(ctx, "5"));
    }
    JS_SetPropertyStr(ctx, callFrame, "this", thisVal);
    JS_SetPropertyStr(ctx, callFrame, "url", JS_NewString(ctx, ""));
    JS_SetPropertyUint32(ctx, callFrames, callFrameId, callFrame);
  }
  return callFrames;
}

JSValue js_debugger_build_backtrace1(JSContext* ctx, const uint8_t* cur_pc) {
  JSValue callFrames = JS_NewArray(ctx);
  // fill callFrames with frame info
  uint32_t stack_index = 0;
  JSStackFrame* sf = ctx->rt->current_stack_frame;
  sf = sf == NULL ? sf : sf->prev_frame;
  while (sf != NULL) {
    uint32_t callFrameId = stack_index++;
    JSValue callFrame = JS_NewObject(ctx);
    // function name
    const char* func_name_str = get_func_name(ctx, sf->cur_func);
    if (!func_name_str || func_name_str[0] == '\0')
      JS_SetPropertyStr(
          ctx, callFrame, "functionName", JS_NewString(ctx, "anonymous"));
    else
      JS_SetPropertyStr(
          ctx, callFrame, "functionName", JS_NewString(ctx, func_name_str));
    JS_FreeCString(ctx, func_name_str);
    JSObject* p = JS_VALUE_GET_OBJ(sf->cur_func);
    if (p && js_class_has_bytecode(p->class_id)) {
      JSFunctionBytecode* b = p->u.func.function_bytecode;
      if (b->has_debug) {
        const uint8_t* pc =
            sf != ctx->rt->current_stack_frame || !cur_pc ? sf->cur_pc : cur_pc;
        int line_num1, col_num1;
        line_num1 = find_line_num(ctx, b, pc - b->byte_code_buf - 1, &col_num1);
        JS_SetPropertyStr(
            ctx, callFrame, "url", JS_AtomToString(ctx, b->debug.filename));
        char str_tmp[64];
        snprintf(str_tmp, 64, "%d", b->debug.filename);
        JS_SetPropertyStr(
            ctx, callFrame, "scriptId", JS_NewString(ctx, str_tmp));
        if (line_num1 != -1) {
          JS_SetPropertyStr(
              ctx, callFrame, "lineNumber", JS_NewUint32(ctx, line_num1 - 1));
          JS_SetPropertyStr(
              ctx, callFrame, "columnNumber", JS_NewUint32(ctx, col_num1 - 1));
        }
      }
    }

    JS_SetPropertyUint32(ctx, callFrames, callFrameId, callFrame);
    sf = sf->prev_frame;
  }
  return callFrames;
}

JSValue js_debugger_build_backtrace(JSContext* ctx, const uint8_t* cur_pc) {
  JSStackFrame* sf;
  const char* func_name_str;
  JSObject* p;
  JSValue ret = JS_NewArray(ctx);
  uint32_t stack_index = 0;

  for (sf = ctx->rt->current_stack_frame; sf != NULL; sf = sf->prev_frame) {
    JSValue current_frame = JS_NewObject(ctx);

    uint32_t id = stack_index++;
    JS_SetPropertyStr(ctx, current_frame, "id", JS_NewUint32(ctx, id));

    func_name_str = get_func_name(ctx, sf->cur_func);
    if (!func_name_str || func_name_str[0] == '\0')
      JS_SetPropertyStr(
          ctx, current_frame, "name", JS_NewString(ctx, "<anonymous>"));
    else
      JS_SetPropertyStr(
          ctx, current_frame, "name", JS_NewString(ctx, func_name_str));
    JS_FreeCString(ctx, func_name_str);

    p = JS_VALUE_GET_OBJ(sf->cur_func);
    if (p && js_class_has_bytecode(p->class_id)) {
      JSFunctionBytecode* b;
      int line_num1, col_num1;

      b = p->u.func.function_bytecode;
      if (b->has_debug) {
        const uint8_t* pc =
            sf != ctx->rt->current_stack_frame || !cur_pc ? sf->cur_pc : cur_pc;
        line_num1 = find_line_num(ctx, b, pc - b->byte_code_buf - 1, &col_num1);
        JS_SetPropertyStr(
            ctx,
            current_frame,
            "filename",
            JS_AtomToString(ctx, b->debug.filename));
        if (line_num1 != -1) {
          JS_SetPropertyStr(
              ctx, current_frame, "line", JS_NewUint32(ctx, line_num1));
          JS_SetPropertyStr(
              ctx, current_frame, "columnNumber", JS_NewUint32(ctx, col_num1));
        }
      }
    } else {
      JS_SetPropertyStr(
          ctx, current_frame, "name", JS_NewString(ctx, "(native)"));
    }
    JS_SetPropertyUint32(ctx, ret, id, current_frame);
  }
  return ret;
}

int js_debugger_check_breakpoint(
    JSContext* ctx,
    uint32_t current_dirty,
    const uint8_t* cur_pc) {
  JSValue path_data = JS_UNDEFINED;
  if (!ctx->rt->current_stack_frame)
    return 0;
  JSObject* f = JS_VALUE_GET_OBJ(ctx->rt->current_stack_frame->cur_func);
  if (!f || !js_class_has_bytecode(f->class_id))
    return 0;
  JSFunctionBytecode* b = f->u.func.function_bytecode;
  if (!b->has_debug || !b->debug.filename)
    return 0;

  JSValue path_dirty_value, breakpoints, breakpoints_length_property;
  uint32_t dirty, path_dirty, breakpoints_length;
  const char* filename = nullptr;
  // check if up to date
  if (b->debugger.dirty == current_dirty)
    goto done;

  // note the dirty value and mark as up to date
  dirty = b->debugger.dirty;
  b->debugger.dirty = current_dirty;

  filename = JS_AtomToCString(ctx, b->debug.filename);
  path_data = js_debugger_file_breakpoints(ctx, filename);
  JS_FreeCString(ctx, filename);
  if (taro_is_undefined(path_data))
    goto done;

  path_dirty_value = JS_GetPropertyStr(ctx, path_data, "dirty");
  JS_ToUint32(ctx, &path_dirty, path_dirty_value);
  JS_FreeValue(ctx, path_dirty_value);
  // check the dirty value on this source file specifically
  if (path_dirty == dirty)
    goto done;

  // todo: bit field?
  // clear/alloc breakpoints
  if (!b->debugger.breakpoints)
    b->debugger.breakpoints =
        static_cast<uint8_t*>(js_malloc_rt(ctx->rt, b->byte_code_len));
  memset(b->debugger.breakpoints, 0, b->byte_code_len);

  breakpoints = JS_GetPropertyStr(ctx, path_data, "breakpoints");

  breakpoints_length_property = JS_GetPropertyStr(ctx, breakpoints, "length");
  JS_ToUint32(ctx, &breakpoints_length, breakpoints_length_property);
  JS_FreeValue(ctx, breakpoints_length_property);

  int line_num, col_num;
  line_num = find_line_num(ctx, b, -1, &col_num);
  for (uint32_t i = 0; i < breakpoints_length; i++) {
    JSValue breakpoint = JS_GetPropertyUint32(ctx, breakpoints, i);
    JSValue breakpoint_line_prop = JS_GetPropertyStr(ctx, breakpoint, "line");
    uint32_t breakpoint_line;
    JS_ToUint32(ctx, &breakpoint_line, breakpoint_line_prop);
    JS_FreeValue(ctx, breakpoint_line_prop);
    JS_FreeValue(ctx, breakpoint);

    // breakpoint is before the current line.
    // todo: this may be an invalid breakpoint if it's inside the function, but
    // got skipped over.
    if (breakpoint_line < line_num)
      continue;
    // breakpoint is after function end. can stop, as breakpoints are in sorted
    // order.
//    if (b->debugger.last_line_num &&
//        breakpoint_line > b->debugger.last_line_num)
//      break;

    // scan until we find the start pc for the breakpoint
    for (uint32_t line_pc = 0; line_pc < b->byte_code_len; line_pc++) {
      line_num = find_line_num(ctx, b, line_pc, &col_num);
      if (line_num == breakpoint_line) {
        b->debugger.breakpoints[line_pc] = 1;
        break;
      }
    }

//    if (!b->debugger.last_line_num || line_num > b->debugger.last_line_num)
//      b->debugger.last_line_num = line_num;
  }

  JS_FreeValue(ctx, breakpoints);

done:
  JS_FreeValue(ctx, path_data);

  if (!b->debugger.breakpoints)
    return 0;

  int pc = (cur_pc ? cur_pc : ctx->rt->current_stack_frame->cur_pc) -
      b->byte_code_buf - 1;
  if (pc < 0 || pc > b->byte_code_len)
    return 0;
  return b->debugger.breakpoints[pc];
}

JSValue js_debugger_local_variables(JSContext* ctx, int stack_index) {
  JSValue ret = JS_NewObject(ctx);

  // put exceptions on the top stack frame
  if (stack_index == 0 && !taro_is_null(ctx->rt->current_exception) &&
      !taro_is_undefined(ctx->rt->current_exception))
    JS_SetPropertyStr(
        ctx, ret, "<exception>", JS_DupValue(ctx, ctx->rt->current_exception));

  JSStackFrame* sf;
  int cur_index = 0;

  for (sf = ctx->rt->current_stack_frame; sf != NULL; sf = sf->prev_frame) {
    // this val is one frame up
    if (cur_index == stack_index - 1) {
      JSObject* f = JS_VALUE_GET_OBJ(sf->cur_func);
      if (f && js_class_has_bytecode(f->class_id)) {
        JSFunctionBytecode* b = f->u.func.function_bytecode;

        JSValue this_obj = sf->var_buf[b->var_count];
        // only provide a this if it is not the global object.
        if (JS_VALUE_GET_OBJ(this_obj) != JS_VALUE_GET_OBJ(ctx->global_obj))
          JS_SetPropertyStr(ctx, ret, "this", JS_DupValue(ctx, this_obj));
      }
    }

    if (cur_index < stack_index) {
      cur_index++;
      continue;
    }

    JSObject* f = JS_VALUE_GET_OBJ(sf->cur_func);
    if (!f || !js_class_has_bytecode(f->class_id))
      goto done;
    JSFunctionBytecode* b = f->u.func.function_bytecode;

    for (uint32_t i = 0; i < b->arg_count + b->var_count; i++) {
      JSValue var_val;
      if (i < b->arg_count)
        var_val = sf->arg_buf[i];
      else
        var_val = sf->var_buf[i - b->arg_count];

      if (taro_is_uninitialized(var_val))
        continue;

      JSVarDef* vd = b->vardefs + i;
      JS_SetProperty(ctx, ret, vd->var_name, JS_DupValue(ctx, var_val));
    }

    break;
  }

done:
  return ret;
}

using VarLoopFunc = std::function<void(JSContext* ctx, JSAtom name, JSValue value)>;
//typedef void (*VarLoopFunc)(JSContext* ctx, JSAtom name, JSValue value);

void js_debugger_local_variables_loop(
    JSContext* ctx,
    int stack_index,
    VarLoopFunc func) {
  // put exceptions on the top stack frame
  if (stack_index == 0 && !taro_is_null(ctx->rt->current_exception) &&
      !taro_is_undefined(ctx->rt->current_exception)) {
    return;
  }

  JSStackFrame* sf;
  int cur_index = 0;

  for (sf = ctx->rt->current_stack_frame; sf != NULL; sf = sf->prev_frame) {
    // this val is one frame up
    if (cur_index == stack_index - 1) {
      JSObject* f = JS_VALUE_GET_OBJ(sf->cur_func);
      if (f && js_class_has_bytecode(f->class_id)) {
        JSFunctionBytecode *b = f->u.func.function_bytecode;

        JSValue this_obj = sf->var_buf[b->var_count];
        // only provide a this if it is not the global object.
        if (JS_VALUE_GET_OBJ(this_obj) != JS_VALUE_GET_OBJ(ctx->global_obj)) {
          // JS_SetPropertyStr(ctx, ret, "this", JS_DupValue(ctx, this_obj));
          JSAtom atomName = JS_NewAtom(ctx, "this");
          func(ctx, atomName, this_obj);
          JS_FreeAtom(ctx, atomName);
        }
      }
    }

    if (cur_index < stack_index) {
      cur_index++;
      continue;
    }

    JSObject* f = JS_VALUE_GET_OBJ(sf->cur_func);
    if (!f || !js_class_has_bytecode(f->class_id))
      return;
    JSFunctionBytecode* b = f->u.func.function_bytecode;

    for (uint32_t i = 0; i < b->arg_count + b->var_count; i++) {
      JSValue var_val;
      if (i < b->arg_count)
        var_val = sf->arg_buf[i];
      else
        var_val = sf->var_buf[i - b->arg_count];

      if (taro_is_uninitialized(var_val))
        continue;

      JSVarDef* vd = b->vardefs + i;
      func(ctx, vd->var_name, var_val);
    }

    break;
  }
}

int js_debugger_local_variables_count(JSContext* ctx, int stack_index) {
  int count = 0;
  js_debugger_local_variables_loop(
      ctx, stack_index, [&count](JSContext* ctx, JSAtom name, JSValue value) {
        count++;
      });
  return count;
}

int js_debugger_local_variables_get(
    JSContext* ctx,
    int stack_index,
    int index,
    JSAtom* name,
    JSValue* value) {
  int count = 0;
  js_debugger_local_variables_loop(
      ctx,
      stack_index,
      [&count, &index, &name, &value](
          JSContext* ctx, JSAtom elemName, JSValue elemValue) {
        if (count == index) {
          *name = JS_DupAtom(ctx, elemName);
          *value = JS_DupValue(ctx, elemValue);
        }
        count++;
      });
  return count == 0 ? -1 : 0;
}

void js_debugger_closure_variables_loop(
    JSContext* ctx,
    int stack_index,
    VarLoopFunc func) {
  JSStackFrame* sf;
  int cur_index = 0;
  for (sf = ctx->rt->current_stack_frame; sf != NULL; sf = sf->prev_frame) {
    if (cur_index < stack_index) {
      cur_index++;
      continue;
    }

    JSObject* f = JS_VALUE_GET_OBJ(sf->cur_func);
    if (!f || !js_class_has_bytecode(f->class_id))
      return;

    JSFunctionBytecode* b = f->u.func.function_bytecode;

    for (uint32_t i = 0; i < b->closure_var_count; i++) {
      JSClosureVar* cvar = b->closure_var + i;
      JSValue var_val;
      JSVarRef* var_ref = NULL;
      if (f->u.func.var_refs)
        var_ref = f->u.func.var_refs[i];
      if (!var_ref || !var_ref->pvalue)
        continue;
      var_val = *var_ref->pvalue;

      if (taro_is_uninitialized(var_val))
        continue;

      func(ctx, cvar->var_name, var_val);
    }

    break;
  }
}

int js_debugger_closure_variables_count(JSContext* ctx, int stack_index) {
  int count = 0;
  js_debugger_closure_variables_loop(
      ctx, stack_index, [&count](JSContext* ctx, JSAtom name, JSValue value) {
        count++;
      });
  return count;
}

int js_debugger_closure_variables_get(
    JSContext* ctx,
    int stack_index,
    int index,
    JSAtom* name,
    JSValue* value) {
  int count = 0;
  js_debugger_closure_variables_loop(
      ctx,
      stack_index,
      [&count, &index, &name, &value](
          JSContext* ctx, JSAtom elemName, JSValue elemValue) {
        if (count == index) {
          *name = JS_DupAtom(ctx, elemName);
          *value = JS_DupValue(ctx, elemValue);
        }
        count++;
      });
  return count == 0 ? -1 : 0;
}

JSValue js_debugger_closure_variables(JSContext* ctx, int stack_index) {
  JSValue ret = JS_NewObject(ctx);

  JSStackFrame* sf;
  int cur_index = 0;
  for (sf = ctx->rt->current_stack_frame; sf != NULL; sf = sf->prev_frame) {
    if (cur_index < stack_index) {
      cur_index++;
      continue;
    }

    JSObject* f = JS_VALUE_GET_OBJ(sf->cur_func);
    if (!f || !js_class_has_bytecode(f->class_id))
      goto done;

    JSFunctionBytecode* b = f->u.func.function_bytecode;

    for (uint32_t i = 0; i < b->closure_var_count; i++) {
      JSClosureVar* cvar = b->closure_var + i;
      JSValue var_val;
      JSVarRef* var_ref = NULL;
      if (f->u.func.var_refs)
        var_ref = f->u.func.var_refs[i];
      if (!var_ref || !var_ref->pvalue)
        continue;
      var_val = *var_ref->pvalue;

      if (taro_is_uninitialized(var_val))
        continue;

      JS_SetProperty(ctx, ret, cvar->var_name, JS_DupValue(ctx, var_val));
    }

    break;
  }

done:
  return ret;
}

/* debugger needs ability to eval at any stack frame */
static JSValue js_debugger_eval(
    JSContext* ctx,
    JSValueConst this_obj,
    JSStackFrame* sf,
    const char* input,
    size_t input_len,
    const char* filename,
    int flags,
    int scope_idx) {
  JSParseState s1, *s = &s1;
  int err, js_mode;
  JSValue fun_obj, ret_val;
  JSVarRef** var_refs;
  JSFunctionBytecode* b;
  JSFunctionDef* fd;

  js_parse_init(ctx, s, input, input_len, filename);
  skip_shebang(&s->buf_ptr, s->buf_end);

  JSObject* p;
  JS_ASSERT_CONTEXT(ctx, sf != NULL);
  JS_ASSERT_CONTEXT(ctx, JS_VALUE_GET_TAG(sf->cur_func) == JS_TAG_OBJECT);
  p = JS_VALUE_GET_OBJ(sf->cur_func);
  JS_ASSERT_CONTEXT(ctx, js_class_has_bytecode(p->class_id));
  b = p->u.func.function_bytecode;
  var_refs = p->u.func.var_refs;
  js_mode = b->js_mode;

  fd = js_new_function_def(ctx, NULL, TRUE, FALSE, filename, s->token.ptr, &s->get_line_col_cache);
  if (!fd)
    goto fail1;
  s->cur_func = fd;
  fd->eval_type = JS_EVAL_TYPE_DIRECT;
  fd->has_this_binding = 0;
  fd->new_target_allowed = b->new_target_allowed;
  fd->super_call_allowed = b->super_call_allowed;
  fd->super_allowed = b->super_allowed;
  fd->arguments_allowed = b->arguments_allowed;
  fd->js_mode = js_mode;
  fd->func_name = JS_DupAtom(ctx, JS_ATOM__eval_);
  if (b) {
    int idx;
    if (!b->var_count)
      idx = -1;
    else
      // use DEBUG_SCOP_INDEX to add all lexical variables to debug eval
      // closure.
      idx = DEBUG_SCOP_INDEX;
    if (add_closure_variables(ctx, fd, b, idx))
      goto fail;
  }
  fd->module = NULL;
  s->is_module = 0;
  s->allow_html_comments = !s->is_module;

  push_scope(s); /* body scope */

  err = js_parse_program(s);
  if (err) {
  fail:
    free_token(s, &s->token);
    js_free_function_def(ctx, fd);
    goto fail1;
  }

  /* create the function object and all the enclosed functions */
  fun_obj = js_create_function(ctx, fd);
  if (taro_is_exception(fun_obj))
    goto fail1;
  if (flags & JS_EVAL_FLAG_COMPILE_ONLY) {
    ret_val = fun_obj;
  } else {
    ret_val = JS_EvalFunctionInternal(ctx, fun_obj, this_obj, var_refs, sf);
  }
  return ret_val;
fail1:
  return JS_EXCEPTION;
}

JSValue
js_debugger_evaluate(JSContext* ctx, int stack_index, JSValue expression) {
  JSStackFrame* sf;
  int cur_index = 0;

  for (sf = ctx->rt->current_stack_frame; sf != NULL; sf = sf->prev_frame) {
    if (cur_index < stack_index) {
      cur_index++;
      continue;
    }

    JSObject* f = JS_VALUE_GET_OBJ(sf->cur_func);
    if (!f || !js_class_has_bytecode(f->class_id))
      return JS_UNDEFINED;
    JSFunctionBytecode* b = f->u.func.function_bytecode;

    int scope_idx = b->vardefs ? 0 : -1;
    size_t len;
    const char* str = JS_ToCStringLen(ctx, &len, expression);
    JSValue ret = js_debugger_eval(
        ctx,
        sf->var_buf[b->var_count],
        sf,
        str,
        len,
        "<debugger>",
        JS_EVAL_TYPE_DIRECT,
        scope_idx);
    JS_FreeCString(ctx, str);
    return ret;
  }
  return JS_UNDEFINED;
}

void js_debugger_clear_all_breakpoints(JSContext* ctx) {
  JSDebuggerInfo* info = js_debugger_info(JS_GetRuntime(ctx));
  if (info != nullptr && info->ctx == ctx) {
    JS_FreeValue(ctx, info->breakpoints);
    info->breakpoints = JS_NULL;
  }
}
#endif
