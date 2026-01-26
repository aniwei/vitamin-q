#pragma once

//#include "QuickJS/common.h"
#include "QuickJS/extension/common.h"
//#include "QuickJS/quickjs.h"

JSValue taro_js_array_length(JSContext* ctx, JSValueConst arr);

#ifdef __cplusplus

JSValue taro_js_array_slice(
    JSContext* ctx,
    JSValueConst arr,
    JSValueConst start = JS_CONST_UNINITIALIZED,
    JSValueConst end = JS_CONST_UNINITIALIZED);

JSValue taro_js_array_splice(
    JSContext* ctx,
    JSValueConst arr,
    JSValueConst start,
    JSValueConst deleteCount = JS_CONST_UNINITIALIZED,
    int items_count = 0,
    JSValueConst* items = NULL);

JSValue taro_js_array_reduce(
    JSContext* ctx,
    JSValueConst arr,
    JSValueConst callback,
    JSValueConst initialValue = JS_CONST_UNINITIALIZED);

JSValue taro_js_array_reduce_right(
    JSContext* ctx,
    JSValueConst arr,
    JSValueConst callback,
    JSValueConst initialValue = JS_CONST_UNINITIALIZED);

JSValue taro_js_array_every(
    JSContext* ctx,
    JSValueConst arr,
    JSValueConst callback,
    JSValueConst thisArg = JS_CONST_UNINITIALIZED);

JSValue taro_js_array_some(
    JSContext* ctx,
    JSValueConst arr,
    JSValueConst callback,
    JSValueConst thisArg = JS_CONST_UNINITIALIZED);

JSValue taro_js_array_foreach(
    JSContext* ctx,
    JSValueConst arr,
    JSValueConst callback,
    JSValueConst thisArg = JS_CONST_UNINITIALIZED);

JSValue taro_js_array_map(
    JSContext* ctx,
    JSValueConst arr,
    JSValueConst callback,
    JSValueConst thisArg = JS_CONST_UNINITIALIZED);

JSValue taro_js_array_filter(
    JSContext* ctx,
    JSValueConst arr,
    JSValueConst callback,
    JSValueConst thisArg = JS_CONST_UNINITIALIZED);

#endif
