#include "QuickJS/extension/taro_js_array.h"

#include "../core/builtins/js-array.h"
#include "../core/builtins/js-function.h"
#include "../core/builtins/js-object.h"
#include "../core/common.h"
#include "../core/runtime.h"

JSValue taro_js_array_length(JSContext* ctx, JSValueConst arr) {
  int64_t len;
  JSValue obj = JS_ToObject(ctx, arr);
  if (JS_IsException(obj))
    return JS_EXCEPTION;

  if (js_get_length64(ctx, &len, obj) < 0) {
    JS_FreeValue(ctx, obj);
    return JS_EXCEPTION;
  }

  JS_FreeValue(ctx, obj);
  return JS_NewInt64(ctx, len);
}

JSValue taro_js_array_slice(
    JSContext* ctx,
    JSValueConst arr,
    JSValueConst start,
    JSValueConst end) {
  JSValueConst argv[2];
  int argc = 2;
  int flags = 0;

  if (JS_IsUninitialized(start)) {
    start = JS_NewInt32(ctx, 0);
    flags |= 1;
  }
  if (JS_IsUninitialized(end)) {
    end = taro_js_array_length(ctx, arr);
    flags |= 2;
  }
  argv[0] = start;
  argv[1] = end;

  JSValue result = js_array_slice(ctx, arr, argc, argv, 0);
  if (flags & 1)
    JS_FreeValue(ctx, start);
  if (flags & 2)
    JS_FreeValue(ctx, end);

  return result;
}

JSValue taro_js_array_splice(
    JSContext* ctx,
    JSValueConst arr,
    JSValueConst start,
    JSValueConst deleteCount,
    int items_count,
    JSValueConst* items) {
  JSValueConst *argv = (JSValueConst *)alloca((2 + items_count) * sizeof(JSValueConst));
  int argc = 1;
  argv[0] = start;

  if (!JS_IsUninitialized(deleteCount)) {
    argv[argc++] = deleteCount;
    for (int i = 0; i < items_count; i++) {
      argv[argc++] = items[i];
    }
  }

  return js_array_slice(ctx, arr, argc, argv, 1);
}

JSValue taro_js_array_reduce(
    JSContext* ctx,
    JSValueConst arr,
    JSValueConst callback,
    JSValueConst initialValue) {
  if (check_function(ctx, callback)) {
    return JS_EXCEPTION;
  }
  JSValueConst argv[2];
  argv[0] = callback;

  int argc = 1;
  if (!JS_IsUninitialized(initialValue)) {
    argv[argc++] = initialValue;
  }
  return js_array_reduce(ctx, arr, argc, argv, special_reduce);
}

JSValue taro_js_array_reduce_right(
    JSContext* ctx,
    JSValueConst arr,
    JSValueConst callback,
    JSValueConst initialValue) {
  if (check_function(ctx, callback)) {
    return JS_EXCEPTION;
  }
  JSValueConst argv[2];
  argv[0] = callback;

  int argc = 1;
  if (!JS_IsUninitialized(initialValue)) {
    argv[argc++] = initialValue;
  }
  return js_array_reduce(ctx, arr, argc, argv, special_reduceRight);
}

JSValue taro_js_array_every(
    JSContext* ctx,
    JSValueConst arr,
    JSValueConst callback,
    JSValueConst thisArg) {
  if (check_function(ctx, callback)) {
    return JS_EXCEPTION;
  }
  JSValueConst argv[2];
  argv[0] = callback;

  int argc = 1;
  if (!JS_IsUninitialized(thisArg)) {
    argv[argc++] = thisArg;
  }
  return js_array_every(ctx, arr, argc, argv, special_every);
}

JSValue taro_js_array_some(
    JSContext* ctx,
    JSValueConst arr,
    JSValueConst callback,
    JSValueConst thisArg) {
  if (check_function(ctx, callback)) {
    return JS_EXCEPTION;
  }
  JSValueConst argv[2];
  argv[0] = callback;

  int argc = 1;
  if (!JS_IsUninitialized(thisArg)) {
    argv[argc++] = thisArg;
  }
  return js_array_every(ctx, arr, argc, argv, special_some);
}

JSValue taro_js_array_foreach(
    JSContext* ctx,
    JSValueConst arr,
    JSValueConst callback,
    JSValueConst thisArg) {
  if (check_function(ctx, callback)) {
    return JS_EXCEPTION;
  }
  JSValueConst argv[2];
  argv[0] = callback;

  int argc = 1;
  if (!JS_IsUninitialized(thisArg)) {
    argv[argc++] = thisArg;
  }
  return js_array_every(ctx, arr, argc, argv, special_forEach);
}

JSValue taro_js_array_map(
    JSContext* ctx,
    JSValueConst arr,
    JSValueConst callback,
    JSValueConst thisArg) {
  if (check_function(ctx, callback)) {
    return JS_EXCEPTION;
  }
  JSValueConst argv[2];
  argv[0] = callback;

  int argc = 1;
  if (!JS_IsUninitialized(thisArg)) {
    argv[argc++] = thisArg;
  }
  return js_array_every(ctx, arr, argc, argv, special_map);
}

JSValue taro_js_array_filter(
    JSContext* ctx,
    JSValueConst arr,
    JSValueConst callback,
    JSValueConst thisArg) {
  if (check_function(ctx, callback)) {
    return JS_EXCEPTION;
  }
  JSValueConst argv[2];
  argv[0] = callback;

  int argc = 1;
  if (!JS_IsUninitialized(thisArg)) {
    argv[argc++] = thisArg;
  }
  return js_array_every(ctx, arr, argc, argv, special_filter);
}
