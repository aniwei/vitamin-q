#pragma once

#include "QuickJS/common.h"
#include "QuickJS/extension/common.h"

#ifdef __cplusplus

#include <string>

JSValue taro_js_json_parse(
    JSContext* ctx,
    JSValueConst text,
    JSValueConst reviver = JS_CONST_UNINITIALIZED);

JSValue taro_js_json_parse(
    JSContext* ctx,
    const std::string& text,
    JSValueConst reviver = JS_CONST_UNINITIALIZED);

JSValue taro_js_json_parse(
    JSContext* ctx,
    const char* text,
    JSValueConst reviver = JS_CONST_UNINITIALIZED);

JSValue taro_js_json_parse(
    JSContext* ctx,
    const char* text,
    size_t len,
    JSValueConst reviver = JS_CONST_UNINITIALIZED);

JSValue taro_js_json_stringify(
    JSContext* ctx,
    JSValueConst value,
    JSValueConst replacer = JS_CONST_UNINITIALIZED,
    JSValueConst space = JS_CONST_UNINITIALIZED);

#endif
