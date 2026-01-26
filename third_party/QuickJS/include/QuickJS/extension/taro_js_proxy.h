#pragma once

#include "QuickJS/common.h"
#include "QuickJS/extension/common.h"
#include "QuickJS/quickjs.h"

JSValue taro_js_proxy_constructor(
    JSContext* ctx,
    JSValueConst target,
    JSValueConst handler);

JSValue taro_js_proxy_target(JSContext* ctx, JSValueConst proxy);
