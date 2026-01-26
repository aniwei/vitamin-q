#pragma once

#include "QuickJS/common.h"
#include "QuickJS/extension/common.h"

#ifdef __cplusplus

JSValue taro_js_promise_constructor(
    JSContext* ctx,
    JSValueConst executor,
    JSValueConst target = JS_CONST_UNINITIALIZED);

JSValue taro_js_promise_resolve(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv,
    int magic);

JSValue taro_js_promise_resolve(
    JSContext* ctx,
    JSValueConst value,
    JSValueConst target = JS_CONST_UNINITIALIZED);

JSValue taro_js_promise_reject(
    JSContext* ctx,
    JSValueConst reason,
    JSValueConst target = JS_CONST_UNINITIALIZED);

JSValue taro_js_promise_all(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv,
    int magic);

JSValue taro_js_promise_all(
    JSContext* ctx,
    JSValueConst iterable,
    JSValueConst target = JS_CONST_UNINITIALIZED);

JSValue taro_js_promise_all_settled(
    JSContext* ctx,
    JSValueConst iterable,
    JSValueConst target = JS_CONST_UNINITIALIZED);

JSValue taro_js_promise_any(
    JSContext* ctx,
    JSValueConst iterable,
    JSValueConst target = JS_CONST_UNINITIALIZED);

JSValue taro_js_promise_race(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv);

JSValue taro_js_promise_race(
    JSContext* ctx,
    JSValueConst iterable,
    JSValueConst target = JS_CONST_UNINITIALIZED);

JSValue taro_js_promise_with_resolvers(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv);

JSValue taro_js_promise_with_resolvers(
    JSContext* ctx,
    JSValueConst iterable,
    JSValueConst target = JS_CONST_UNINITIALIZED);

JSValue taro_js_promise_then(
    JSContext* ctx,
    JSValueConst onResolved,
    JSValueConst target);

JSValue taro_js_promise_then(
    JSContext* ctx,
    JSValueConst onResolved,
    JSValueConst onRejected,
    JSValueConst target);

JSValue taro_js_promise_catch(
    JSContext* ctx,
    JSValueConst onRejected,
    JSValueConst target);

JSValue taro_js_promise_finally(
    JSContext* ctx,
    JSValueConst onFinally,
    JSValueConst target);

void taro_js_promise_set_opaque(JSContext* ctx, JSValue promise, void* opaque);

void* taro_js_promise_get_opaque(JSContext* ctx, JSValue promise);

#endif
