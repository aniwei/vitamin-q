#include "QuickJS/extension/taro_js_runtime.h"

#include "../core/runtime.h"
#include "../core/builtins/js-function.h"
#include "../core/common.h"

void taro_js_set_property_function_list(
    JSContext* ctx,
    JSValueConst obj,
    const JSCFunctionListEntry* tab,
    int len) {
  JS_SetPropertyFunctionList(ctx, obj, tab, len);
}

JSAtom taro_js_find_atom(
  JSContext* ctx,
  const char* name) {
  return find_atom(ctx, name);
}

JSValue taro_js_get_this(JSContext* ctx, JSValueConst thisVal) {
  return JS_DupValue(ctx, thisVal);
}

int taro_js_ref_count(JSValueConst val) {
  if (JS_VALUE_HAS_REF_COUNT(val)) {
    JSRefCountHeader* p = (JSRefCountHeader*)JS_VALUE_GET_PTR(val);
    return p->ref_count;
  }
  return -1;
}
