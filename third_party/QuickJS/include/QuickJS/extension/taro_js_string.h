#pragma once

#include "QuickJS/common.h"
#include "QuickJS/extension/common.h"
#include "QuickJS/quickjs.h"

JSValue taro_js_string_trim(JSContext* ctx, JSValueConst str);

JSValue taro_js_string_trim_start(JSContext* ctx, JSValueConst str);

JSValue taro_js_string_trim_end(JSContext* ctx, JSValueConst str);

JSValue taro_js_string_to_lower_case(JSContext* ctx, JSValueConst str);

JSValue taro_js_string_to_upper_case(JSContext* ctx, JSValueConst str);

#ifdef __cplusplus

JSValue taro_js_string_split(
    JSContext* ctx,
    JSValueConst str,
    JSValueConst separator,
    JSValueConst limit = JS_CONST_UNINITIALIZED);

JSValue taro_js_string_includes(
    JSContext* ctx,
    JSValueConst str,
    JSValueConst search,
    JSValueConst position = JS_CONST_UNINITIALIZED);

JSValue taro_js_string_starts_with(
    JSContext* ctx,
    JSValueConst str,
    JSValueConst search,
    JSValueConst position = JS_CONST_UNINITIALIZED);

JSValue taro_js_string_ends_with(
    JSContext* ctx,
    JSValueConst str,
    JSValueConst search,
    JSValueConst endPosition = JS_CONST_UNINITIALIZED);

#endif

JSValue taro_js_string_replace(
    JSContext* ctx,
    JSValueConst str,
    JSValueConst search,
    JSValueConst replace);

JSValue taro_js_string_replace_all(
    JSContext* ctx,
    JSValueConst str,
    JSValueConst search,
    JSValueConst replace);
