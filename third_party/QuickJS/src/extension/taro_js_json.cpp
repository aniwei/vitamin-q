#include "QuickJS/extension/taro_js_json.h"

#include "../core/builtins/js-json.h"
#include "../core/common.h"
#include "QuickJS/quickjs.h"

JSValue taro_js_json_parse(JSContext* ctx, JSValueConst text, JSValueConst reviver) {
  size_t len = 0;
  const char* str = JS_ToCStringLen(ctx, &len, text);
  if (!str) {
    return JS_EXCEPTION;
  }
  JSValue result = taro_js_json_parse(ctx, str, len, reviver);
  JS_FreeCString(ctx, str);
  return result;
}

JSValue taro_js_json_parse(
    JSContext* ctx,
    const std::string& text,
    JSValueConst reviver) {
  return taro_js_json_parse(ctx, text.c_str(), text.length(), reviver);
}

JSValue taro_js_json_parse(
  JSContext* ctx,
  const char* text,
  JSValueConst reviver) {
return taro_js_json_parse(ctx, text, strlen(text), reviver);
}

JSValue taro_js_json_parse(
    JSContext* ctx,
    const char* text,
    size_t len,
    JSValueConst reviver) {
  JSValue obj, root;

  obj = JS_ParseJSON(ctx, text, len, "<input>");
  if (taro_is_exception(obj))
    return obj;
  if (taro_is_function(ctx, reviver)) {
    root = JS_NewObject(ctx);
    if (taro_is_exception(root)) {
      JS_FreeValue(ctx, obj);
      return JS_EXCEPTION;
    }
    if (JS_DefinePropertyValue(
            ctx, root, JS_ATOM_empty_string, obj, JS_PROP_C_W_E) < 0) {
      JS_FreeValue(ctx, root);
      return JS_EXCEPTION;
    }
    obj = internalize_json_property(ctx, root, JS_ATOM_empty_string, reviver);
    JS_FreeValue(ctx, root);
  }
  return obj;
}

JSValue taro_js_json_stringify(
    JSContext* ctx,
    JSValueConst value,
    JSValueConst replacer,
    JSValueConst space) {
  return JS_JSONStringify(ctx, value, replacer, space);
}
