#include "QuickJS/extension/taro_js_error.h"

#include "../core/runtime.h"
#include "QuickJS/extension/taro_js_type.h"

JSValue taro_js_throw(JSContext* ctx, JSValue obj) {
  JSRuntime* rt = ctx->rt;
  JS_FreeValue(ctx, rt->current_exception);
  rt->current_exception = obj;
#if QUICKJS_ENABLE_DEBUGGER
  js_debugger_exception(ctx);
#endif
  return JS_EXCEPTION;
}

JSValue taro_js_get_exception(JSContext* ctx) {
  JSValue val;
  JSRuntime* rt = ctx->rt;
  val = rt->current_exception;
  rt->current_exception = JS_NULL;
  return val;
}

JS_BOOL taro_js_has_exception(JSContext* ctx) {
  int tag = JS_VALUE_GET_TAG(ctx->rt->current_exception);
  return !(
      js_unlikely(tag == JS_TAG_UNINITIALIZED) || tag == JS_TAG_UNDEFINED ||
      tag == JS_TAG_NULL);
}

JSValue taro_js_new_error(JSContext* ctx) {
  return JS_NewObjectClass(ctx, JS_CLASS_ERROR);
}

JSValue
taro_js_new_error(JSContext* ctx, JSErrorEnum error_num, const char* fmt, ...) {
  va_list args;
  va_start(args, fmt);
  JSValue error = taro_js_new_error(ctx, error_num, fmt, args);
  va_end(args);
  return error;
}

JSValue taro_js_new_error(
    JSContext* ctx,
    JSErrorEnum error_num,
    const char* fmt,
    va_list ap) {
  JSRuntime* rt = ctx->rt;
  JSStackFrame* sf;
  BOOL add_backtrace;

  /* the backtrace is added later if called from a bytecode function */
  sf = rt->current_stack_frame;
  add_backtrace = !rt->in_out_of_memory &&
      (!sf || (JS_GetFunctionBytecode(sf->cur_func) == NULL));
  return taro_js_new_error(ctx, error_num, fmt, ap, add_backtrace);
}

JSValue taro_js_new_error(
    JSContext* ctx,
    JSErrorEnum error_num,
    const char* fmt,
    va_list ap,
    JS_BOOL add_backtrace) {
  char buf[256];

  vsnprintf(buf, sizeof(buf), fmt, ap);
  JSValue obj = JS_NewObjectProtoClass(
      ctx, ctx->native_error_proto[error_num], JS_CLASS_ERROR);
  if (unlikely(JS_IsException(obj))) {
    /* out of memory: throw JS_NULL to avoid recursing */
    obj = JS_NULL;
  } else {
    JS_DefinePropertyValue(
        ctx,
        obj,
        JS_ATOM_message,
        JS_NewString(ctx, buf),
        JS_PROP_WRITABLE | JS_PROP_CONFIGURABLE);
  }
  if (add_backtrace) {
    build_backtrace(ctx, obj, NULL, 0, 0, 0);
  }
  return obj;
}

JSValue taro_js_error_to_string(JSContext* ctx, JSValueConst this_val) {
  return js_error_toString(ctx, this_val, 0, {});
}

void (*js_assert_handler)(const char* message) = NULL;

void js_set_assert_handler(void (*handler)(const char* msg)) {
  js_assert_handler = handler;
}
