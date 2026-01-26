#pragma once

#include "QuickJS/common.h"
#include "QuickJS/extension/common.h"
#include "QuickJS/quickjs.h"

#ifdef __cplusplus

JSValue
taro_js_bigint_to_string(JSContext* ctx, JSValueConst val, int radix = 10);

#endif
