#include "QuickJS/extension/taro_js_string.h"

#include <string>

#include "../core/builtins/js-string.h"
#include "../core/common.h"

JSValue taro_js_string_trim(JSContext* ctx, JSValueConst str) {
  return js_string_trim(ctx, str, 0, NULL, 3);
}

JSValue taro_js_string_trim_start(JSContext* ctx, JSValueConst str) {
  return js_string_trim(ctx, str, 0, NULL, 1);
}

JSValue taro_js_string_trim_end(JSContext* ctx, JSValueConst str) {
  return js_string_trim(ctx, str, 0, NULL, 2);
}

JSValue taro_js_string_to_lower_case(JSContext* ctx, JSValueConst str) {
  return js_string_toLowerCase(ctx, str, 0, NULL, 1);
}

JSValue taro_js_string_to_upper_case(JSContext* ctx, JSValueConst str) {
  return js_string_toLowerCase(ctx, str, 0, NULL, 0);
}

JSValue taro_js_string_split(
    JSContext* ctx,
    JSValueConst str,
    JSValueConst separator,
    JSValueConst limit) {
  JSValueConst argv[2];
  int argc = 1;
  int flags = 0;
  argv[0] = separator;

  if (JS_IsUninitialized(limit)) {
    JSString *p = JS_VALUE_GET_STRING(str);
    limit = JS_NewInt32(ctx, p->len + 1);
    flags |= 1;
  }
  argv[argc++] = limit;

  JSValue result = js_string_split(ctx, str, argc, argv);
  if (flags & 1)
    JS_FreeValue(ctx, limit);

  return result;
}

JSValue taro_js_string_includes(
    JSContext* ctx,
    JSValueConst str,
    JSValueConst search,
    JSValueConst position) {
  JSValueConst argv[2];
  int argc = 1;
  argv[0] = search;

  if (!JS_IsUninitialized(position)) {
    argv[argc++] = position;
  }

  return js_string_includes(ctx, str, argc, argv, 0);
}

JSValue taro_js_string_starts_with(
    JSContext* ctx,
    JSValueConst str,
    JSValueConst search,
    JSValueConst position) {
  JSValueConst argv[2];
  int argc = 1;
  argv[0] = search;

  if (!JS_IsUninitialized(position)) {
    argv[argc++] = position;
  }

  return js_string_includes(ctx, str, argc, argv, 1);
}

JSValue taro_js_string_ends_with(
    JSContext* ctx,
    JSValueConst str,
    JSValueConst search,
    JSValueConst endPosition) {
  JSValueConst argv[2];
  int argc = 1;
  argv[0] = search;

  if (!JS_IsUninitialized(endPosition)) {
    argv[argc++] = endPosition;
  }

  return js_string_includes(ctx, str, argc, argv, 2);
}

JSValue taro_js_string_replace(
    JSContext* ctx,
    JSValueConst str,
    JSValueConst search,
    JSValueConst replace) {
  JSValueConst argv[2];
  argv[0] = search;
  argv[1] = replace;

  return js_string_replace(ctx, str, 2, argv, 0);
}

JSValue taro_js_string_replace_all(
    JSContext* ctx,
    JSValueConst str,
    JSValueConst search,
    JSValueConst replace) {
  JSValueConst argv[2];
  argv[0] = search;
  argv[1] = replace;

  return js_string_replace(ctx, str, 2, argv, 1);
}
