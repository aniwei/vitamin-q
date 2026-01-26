#include "QuickJS/extension/taro_js_type.h"

#include "QuickJS/list.h"

#include "../core/builtins/js-proxy.h"
#include "../core/convertion.h"
#include "../core/function.h"
#include "../core/gc.h"
#include "../core/runtime.h"
#include "../core/types.h"

/* return -1 if exception (proxy case) or TRUE/FALSE */
// TODO: should take flags to make proxy resolution and exceptions optional
int taro_is_array(JSContext* ctx, JSValueConst val) {
  if (js_resolve_proxy(ctx, &val, TRUE))
    return -1;
  if (JS_VALUE_GET_TAG(val) == JS_TAG_OBJECT) {
    JSObject* p = JS_VALUE_GET_OBJ(val);
    return p->class_id == JS_CLASS_ARRAY;
  } else {
    return FALSE;
  }
}

int taro_is_array_buffer(JSContext* ctx, JSValueConst val) {
  JSObject* p;
  if (JS_VALUE_GET_TAG(val) == JS_TAG_OBJECT) {
    p = JS_VALUE_GET_OBJ(val);
    return p->class_id == JS_CLASS_ARRAY_BUFFER ||
        p->class_id == JS_CLASS_SHARED_ARRAY_BUFFER;
  } else {
    return FALSE;
  }
}

int taro_is_error(JSContext* ctx, JSValueConst val) {
  JSObject* p;
  if (JS_VALUE_GET_TAG(val) != JS_TAG_OBJECT)
    return FALSE;
  p = JS_VALUE_GET_OBJ(val);
  return (p->class_id == JS_CLASS_ERROR);
}

int taro_is_function(JSContext* ctx, JSValueConst val) {
  JSObject* p;
  if (JS_VALUE_GET_TAG(val) != JS_TAG_OBJECT)
    return FALSE;
  p = JS_VALUE_GET_OBJ(val);
  switch (p->class_id) {
    case JS_CLASS_BYTECODE_FUNCTION:
      return TRUE;
    case JS_CLASS_PROXY:
      return p->u.proxy_data->is_func;
    default:
      return (ctx->rt->class_array[p->class_id].call != NULL);
  }
}

int taro_is_constructor(JSContext* ctx, JSValueConst val) {
  JSObject* p;
  if (JS_VALUE_GET_TAG(val) != JS_TAG_OBJECT)
    return FALSE;
  p = JS_VALUE_GET_OBJ(val);
  return p->is_constructor;
}

int taro_is_extensible(JSContext* ctx, JSValueConst obj) {
  JSObject* p;

  if (unlikely(JS_VALUE_GET_TAG(obj) != JS_TAG_OBJECT))
    return FALSE;
  p = JS_VALUE_GET_OBJ(obj);
  if (unlikely(p->class_id == JS_CLASS_PROXY))
    return js_proxy_is_extensible(ctx, obj);
  else
    return p->extensible;
}

int taro_is_instance_of(JSContext* ctx, JSValueConst val, JSValueConst obj) {
  JSValue method;

  if (!taro_is_object(obj))
    goto fail;
  method = JS_GetProperty(ctx, obj, JS_ATOM_Symbol_hasInstance);
  if (taro_is_exception(method))
    return -1;
  if (!taro_is_null(method) && !taro_is_undefined(method)) {
    JSValue ret;
    ret = JS_CallFree(ctx, method, obj, 1, &val);
    return JS_ToBoolFree(ctx, ret);
  }

  /* legacy case */
  if (!JS_IsFunction(ctx, obj)) {
  fail:
    JS_ThrowTypeError(ctx, "invalid 'instanceof' right operand");
    return -1;
  }
  return JS_OrdinaryIsInstanceOf(ctx, val, obj);
}

int taro_is_live_object(JSRuntime* rt, JSValueConst obj) {
  JSObject* p;
  if (!taro_is_object(obj))
    return FALSE;
  p = JS_VALUE_GET_OBJ(obj);
  return !p->free_mark;
}

int taro_is_registered_class(JSRuntime* rt, JSClassID class_id) {
  return (
      class_id < rt->class_count && rt->class_array[class_id].class_id != 0);
}

int taro_is_job_pending(JSRuntime* rt) {
  return !list_empty(&rt->job_list);
}
