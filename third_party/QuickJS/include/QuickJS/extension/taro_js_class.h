#pragma once

#include "QuickJS/common.h"

#ifdef __cplusplus

JSClassID taro_js_new_class_id(JSClassID* pclass_id = NULL);
JSClassID taro_js_get_class_id(JSValue obj);

int taro_js_new_class(
    JSRuntime* rt,
    JSClassID class_id,
    const JSClassDef* class_def);
JSValue taro_js_new_object_class_proto(
    JSContext* ctx,
    JSClassID class_id,
    JSValueConst proto);
JSValue taro_js_new_object_class(JSContext* ctx, JSClassID class_id);
JSValue taro_js_new_object_proto(JSContext* ctx, JSValueConst proto);

// taro_js_new_function_opaque

void taro_js_set_class_proto(JSContext* ctx, JSClassID class_id, JSValue obj);
JSValue taro_js_get_class_proto(JSContext* ctx, JSClassID class_id);

void taro_js_set_opaque(JSValue obj, void* opaque);
void* taro_js_get_opaque(JSValueConst obj, JSClassID class_id);
void* taro_js_get_opaque(JSContext* ctx, JSValueConst obj, JSClassID class_id);

bool taro_js_is_object_of_class(JSValueConst obj, JSClassID class_id);
bool taro_js_is_promise(JSContext* ctx, JSValueConst obj);

#endif // __cplusplus
