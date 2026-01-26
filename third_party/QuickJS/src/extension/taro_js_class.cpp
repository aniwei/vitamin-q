#include "QuickJS/extension/taro_js_class.h"

#include "QuickJS/quickjs.h"

#include "../core/exception.h"
#include "../core/runtime.h"
#include "../core/types.h"

JSClassID taro_js_new_class_id(JSClassID* pclass_id) {
  if (pclass_id == NULL) {
    JSClassID temp_id = 0;
    return JS_NewClassID(&temp_id);
  }
  return JS_NewClassID(pclass_id);
}

JSClassID taro_js_get_class_id(JSValue obj) {
  return JS_GetClassID(obj);
}

int taro_js_new_class(
    JSRuntime* rt,
    JSClassID class_id,
    const JSClassDef* class_def) {
  return JS_NewClass(rt, class_id, class_def);
}

JSValue taro_js_new_object_class_proto(
    JSContext* ctx,
    JSClassID class_id,
    JSValueConst proto) {
  return JS_NewObjectProtoClass(ctx, proto, class_id);
}

JSValue taro_js_new_object_class(JSContext* ctx, JSClassID class_id) {
  return JS_NewObjectClass(ctx, class_id);
}

JSValue taro_js_new_object_proto(JSContext* ctx, JSValueConst proto) {
  return JS_NewObjectProto(ctx, proto);
}

// taro_js_new_function_opaque

void taro_js_set_class_proto(JSContext* ctx, JSClassID class_id, JSValue obj) {
  JS_SetClassProto(ctx, class_id, obj);
}

JSValue taro_js_get_class_proto(JSContext* ctx, JSClassID class_id) {
  return JS_GetClassProto(ctx, class_id);
}

void taro_js_set_opaque(JSValue obj, void* opaque) {
  JS_SetOpaque(obj, opaque);
}

void* taro_js_get_opaque(JSValueConst obj, JSClassID class_id) {
  return JS_GetOpaque(obj, class_id);
}

void* taro_js_get_opaque(JSContext* ctx, JSValueConst obj, JSClassID class_id) {
  return JS_GetOpaque2(ctx, obj, class_id);
}

bool taro_js_is_object_of_class(JSValueConst obj, JSClassID class_id) {
  if (!JS_IsObject(obj))
    return false;

  JSClassID obj_class_id = taro_js_get_class_id(obj);
  return obj_class_id == class_id && obj_class_id != JS_INVALID_CLASS_ID;
}

bool taro_js_is_promise(JSContext* ctx, JSValueConst obj) {
  if (taro_js_is_object_of_class(obj, JS_CLASS_PROMISE))
    return true;

  return JS_PromiseState(ctx, obj) >= 0;
}
