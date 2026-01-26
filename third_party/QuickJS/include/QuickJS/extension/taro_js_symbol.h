#pragma once

#include "QuickJS/common.h"
#include "QuickJS/extension/common.h"
#include "QuickJS/quickjs.h"

JSValue taro_js_symbol_to_string(JSContext* ctx, JSValueConst symbol);
