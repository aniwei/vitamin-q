#pragma once

#include "QuickJS/common.h"
#include "QuickJS/extension/common.h"

#ifdef __cplusplus

JSValue taro_js_object_assign(
    JSContext* ctx,
    JSValueConst target,
    int sourcesCount,
    JSValueConst* sources);

JSValue
taro_js_object_assign(JSContext* ctx, JSValueConst target, JSValueConst source);

JSValue taro_js_object_create(
    JSContext* ctx,
    JSValueConst proto,
    JSValueConst propertiesObject = JS_CONST_UNINITIALIZED);

#endif

JSValue taro_js_object_entries(JSContext* ctx, JSValueConst obj);

JSValue taro_js_object_keys(JSContext* ctx, JSValueConst obj);

JSValue taro_js_object_values(JSContext* ctx, JSValueConst obj);

JSValue taro_js_object_to_string(JSContext* ctx, JSValueConst this_val);

JSValue taro_js_object_from_entries(JSContext* ctx, JSValueConst entries);

JSValue
taro_js_object_has_own(JSContext* ctx, JSValueConst obj, JSValueConst prop);

JSValue taro_js_object_get_own_property_names(JSContext* ctx, JSValueConst obj);

JSValue taro_js_object_get_own_property_descriptors(
    JSContext* ctx,
    JSValueConst obj);

JSValue taro_js_object_get_own_property_descriptor(
    JSContext* ctx,
    JSValueConst obj,
    JSValueConst prop);

JSValue taro_js_object_define_properties(
    JSContext* ctx,
    JSValueConst obj,
    JSValueConst properties);

JSValue taro_js_object_define_property(
    JSContext* ctx,
    JSValueConst obj,
    JSValueConst prop,
    JSValueConst descriptor);

JSValue taro_js_object_freeze(JSContext* ctx, JSValueConst obj);

JSValue taro_js_object_seal(JSContext* ctx, JSValueConst obj);

JSValue taro_js_object_prevent_extensions(JSContext* ctx, JSValueConst obj);

JSValue
taro_js_object_is(JSContext* ctx, JSValueConst value1, JSValueConst value2);

JSValue taro_js_object_is_frozen(JSContext* ctx, JSValueConst obj);

JSValue taro_js_object_is_sealed(JSContext* ctx, JSValueConst obj);

JSValue taro_js_object_is_extensible(JSContext* ctx, JSValueConst obj);

JSValue taro_js_object_set_prototype_of(JSContext* ctx, JSValueConst obj, JSValueConst proto);
  
JSValue taro_js_object_get_prototype_of(JSContext* ctx, JSValueConst obj);