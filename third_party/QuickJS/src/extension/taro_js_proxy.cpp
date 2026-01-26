#include "QuickJS/extension/taro_js_error.h"

#include "../core/builtins/js-proxy.h"

JSValue taro_js_proxy_constructor(
    JSContext* ctx,
    JSValueConst target,
    JSValueConst handler) {
  JSValueConst argv[2] = {target, handler};
  int argc = 2;
  return js_proxy_constructor(ctx, JS_UNDEFINED, argc, argv);
}

JSValue taro_js_proxy_target(JSContext* ctx, JSValueConst proxy) {
  return js_proxy_target(ctx, proxy);
}
