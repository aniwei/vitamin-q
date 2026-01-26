#pragma once

#include "QuickJS/common.h"
#include "QuickJS/extension/common.h"
#include "QuickJS/quickjs.h"

JSValue taro_js_throw(JSContext* ctx, JSValue obj);

JSValue taro_js_get_exception(JSContext* ctx);

JS_BOOL taro_js_has_exception(JSContext* ctx);

#ifdef __cplusplus

JSValue taro_js_new_error(JSContext* ctx);

JSValue taro_js_new_error(
    JSContext* ctx,
    JSErrorEnum error_num,
    const char* fmt, ...);

JSValue taro_js_new_error(
    JSContext* ctx,
    JSErrorEnum error_num,
    const char* fmt,
    va_list ap);

JSValue taro_js_new_error(
    JSContext* ctx,
    JSErrorEnum error_num,
    const char* fmt,
    va_list ap,
    JS_BOOL add_backtrace);

#endif

/* Stringify error */
JSValue taro_js_error_to_string(JSContext* ctx, JSValueConst this_val);

void js_set_assert_handler(void (*handler)(const char* msg));

extern void (*js_assert_handler)(const char* message);

#if TARO_DEV
#define JS_ASSERT(expression) assert(expression)
#define JS_ASSERT_CONTEXT(ctx, expression) assert(expression)
#else
#define JS_ASSERT(expression)           \
  {                                     \
    if (js_assert_handler == NULL) {    \
      assert(expression);               \
    } else {                            \
      if (!(expression)) {              \
        js_assert_handler(#expression); \
      }                                 \
    }                                   \
  }
#define JS_ASSERT_CONTEXT(ctx, expression)     \
  if (!(expression)) {                         \
    if (ctx->has_throw_exception == 0) {       \
      ctx->has_throw_exception = 1;            \
      JS_ThrowInternalError(ctx, #expression); \
      if (js_assert_handler) {                 \
        js_assert_handler(#expression);        \
      } else {                                 \
        assert(expression);                    \
      }                                        \
    } else {                                   \
      if (js_assert_handler != NULL) {         \
        js_assert_handler(#expression);        \
      }                                        \
    }                                          \
  }
#endif
