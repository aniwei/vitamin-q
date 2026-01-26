#pragma once

#include "QuickJS/common.h"

#ifdef __cplusplus

JSValue taro_js_function_to_string(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv);

JSValue taro_js_function_apply(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv,
    int magic);

JSValue taro_js_function_call(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv);

JSValue taro_js_function_bind(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv);

JSValue taro_js_function_has_instance(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv);

JSValue taro_js_function_filename(
    JSContext* ctx,
    JSValueConst this_val);

JSValue taro_js_function_line_number(
    JSContext* ctx,
    JSValueConst this_val);

JSValue taro_js_function_column_number(
    JSContext* ctx,
    JSValueConst this_val);

#endif
