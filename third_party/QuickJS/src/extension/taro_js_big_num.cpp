#include "QuickJS/extension/taro_js_big_num.h"

#include "../core/builtins/js-big-num.h"

JSValue taro_js_bigint_to_string(JSContext* ctx, JSValueConst val, int radix) {
  if (radix != 0 && (radix < 2 || radix > 36)) {
    return JS_ThrowRangeError(ctx, "radix must be between 2 and 36");
  }
  return js_bigint_to_string1(ctx, val, radix);
}
