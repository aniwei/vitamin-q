#include "QuickJS/extension/taro_js_promise.h"

#include "../core/builtins/js-promise.h"
#include "../core/common.h"

JSValue taro_js_promise_constructor(
    JSContext* ctx,
    JSValueConst executor,
    JSValueConst target) {
  JSValueConst argv[1] = {executor};
  JSValueConst new_target = JS_IsUninitialized(target) ? JS_UNDEFINED : target;

  return js_promise_constructor(ctx, new_target, 1, argv);
}

JSValue taro_js_promise_resolve(
  JSContext* ctx,
  JSValueConst this_val,
  int argc,
  JSValueConst* argv,
  int magic) {
  return js_promise_resolve(ctx, this_val, argc, argv, magic);
}

JSValue taro_js_promise_resolve(
    JSContext* ctx,
    JSValueConst value,
    JSValueConst target) {
  JSValue ctor =
      JS_DupValue(ctx, JS_IsUninitialized(target) ? ctx->promise_ctor : target);

  JSValueConst argv[1] = {value};
  JSValue result = js_promise_resolve(ctx, ctor, 1, argv, 0);

  JS_FreeValue(ctx, ctor);
  return result;
}

JSValue taro_js_promise_reject(
    JSContext* ctx,
    JSValueConst reason,
    JSValueConst target) {
  JSValue ctor =
      JS_DupValue(ctx, JS_IsUninitialized(target) ? ctx->promise_ctor : target);

  JSValueConst argv[1] = {reason};
  JSValue result = js_promise_resolve(ctx, ctor, 1, argv, 1);

  JS_FreeValue(ctx, ctor);
  return result;
}

JSValue taro_js_promise_all(
  JSContext* ctx,
  JSValueConst this_val,
  int argc,
  JSValueConst* argv,
  int magic) {
  return js_promise_all(ctx, this_val, argc, argv, magic);
}

JSValue taro_js_promise_all(
    JSContext* ctx,
    JSValueConst iterable,
    JSValueConst target) {
  JSValue ctor =
      JS_DupValue(ctx, JS_IsUninitialized(target) ? ctx->promise_ctor : target);

  JSValueConst argv[1] = {iterable};
  JSValue result = js_promise_all(ctx, ctor, 1, argv, PROMISE_MAGIC_all);

  JS_FreeValue(ctx, ctor);
  return result;
}

JSValue taro_js_promise_all_settled(
    JSContext* ctx,
    JSValueConst iterable,
    JSValueConst target) {
  JSValue ctor =
      JS_DupValue(ctx, JS_IsUninitialized(target) ? ctx->promise_ctor : target);

  JSValueConst argv[1] = {iterable};
  JSValue result = js_promise_all(ctx, ctor, 1, argv, PROMISE_MAGIC_allSettled);

  JS_FreeValue(ctx, ctor);
  return result;
}

JSValue taro_js_promise_any(
    JSContext* ctx,
    JSValueConst iterable,
    JSValueConst target) {
  JSValue ctor =
      JS_DupValue(ctx, JS_IsUninitialized(target) ? ctx->promise_ctor : target);

  JSValueConst argv[1] = {iterable};
  JSValue result = js_promise_all(ctx, ctor, 1, argv, PROMISE_MAGIC_any);

  JS_FreeValue(ctx, ctor);
  return result;
}

JSValue taro_js_promise_race(
  JSContext* ctx,
  JSValueConst this_val,
  int argc,
  JSValueConst* argv) {
  return js_promise_race(ctx, this_val, argc, argv);
}

JSValue taro_js_promise_race(
  JSContext* ctx,
  JSValueConst iterable,
  JSValueConst target) {
  JSValue ctor =
      JS_DupValue(ctx, JS_IsUninitialized(target) ? ctx->promise_ctor : target);

  JSValueConst argv[1] = {iterable};
  JSValue result = js_promise_race(ctx, ctor, 1, argv);

  JS_FreeValue(ctx, ctor);
  return result;
}

JSValue taro_js_promise_with_resolvers(
  JSContext* ctx,
  JSValueConst this_val,
  int argc,
  JSValueConst* argv) {
  return js_promise_withResolvers(ctx, this_val, argc, argv);
}

JSValue taro_js_promise_with_resolvers(
    JSContext* ctx,
    JSValueConst iterable,
    JSValueConst target) {
  JSValue ctor =
      JS_DupValue(ctx, JS_IsUninitialized(target) ? ctx->promise_ctor : target);

  JSValueConst argv[1] = {iterable};
  JSValue result = js_promise_withResolvers(ctx, ctor, 1, argv);

  JS_FreeValue(ctx, ctor);
  return result;
}

JSValue taro_js_promise_then(
    JSContext* ctx,
    JSValueConst onResolved,
    JSValueConst target) {
  JSValueConst argv[2] = {onResolved, JS_CONST_UNINITIALIZED}; // perform_promise_then 未处理第二参数，不传入可能存在隐患
  return js_promise_then(ctx, target, 2, argv);
}

JSValue taro_js_promise_then(
    JSContext* ctx,
    JSValueConst onResolved,
    JSValueConst onRejected,
    JSValueConst target) {
  JSValueConst argv[2] = {onResolved, onRejected};
  return js_promise_then(ctx, target, 2, argv);
}

JSValue taro_js_promise_catch(
    JSContext* ctx,
    JSValueConst onRejected,
    JSValueConst target) {
  JSValueConst argv[1] = {onRejected};
  return js_promise_catch(ctx, target, 1, argv);
}

JSValue taro_js_promise_finally(
    JSContext* ctx,
    JSValueConst onFinally,
    JSValueConst target) {
  JSValueConst argv[1] = {onFinally};
  return js_promise_finally(ctx, target, 1, argv);
}

void taro_js_promise_set_opaque(
    JSContext* ctx,
    JSValue promise,
    void* opaque) {
  return js_promise_set_opaque(ctx, promise, opaque);
}

void* taro_js_promise_get_opaque(
    JSContext* ctx,
    JSValue promise) {
  return js_promise_get_opaque(ctx, promise);
}
