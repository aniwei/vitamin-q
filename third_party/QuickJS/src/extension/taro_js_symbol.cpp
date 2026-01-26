#include "QuickJS/extension/taro_js_symbol.h"

#include "../core/builtins/js-string.h"
#include "../core/builtins/js-symbol.h"
#include "../core/common.h"

JSValue taro_js_symbol_to_string(JSContext* ctx, JSValueConst symbol) {
  JSValue val, ret;
  val = js_thisSymbolValue(ctx, symbol);
  if (JS_IsException(val))
    return val;
  /* XXX: use JS_ToStringInternal() with a flags */
  ret = js_string_constructor(ctx, JS_UNDEFINED, 1, (JSValueConst*)&val);
  JS_FreeValue(ctx, val);
  return ret;
}
