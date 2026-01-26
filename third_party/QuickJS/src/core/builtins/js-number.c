/*
 * QuickJS Javascript Engine
 *
 * Copyright (c) 2017-2025 Fabrice Bellard
 * Copyright (c) 2017-2025 Charlie Gordon
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

#include "js-number.h"
#include "QuickJS/dtoa.h"
#include "../convertion.h"
#include "../exception.h"
#include "../object.h"
#include "../runtime.h"
#include "js-big-num.h"

/* Number */

JSValue js_number_constructor(
    JSContext* ctx,
    JSValueConst new_target,
    int argc,
    JSValueConst* argv) {
  JSValue val, obj;
  if (argc == 0) {
    val = JS_NewInt32(ctx, 0);
  } else {
    val = JS_ToNumeric(ctx, argv[0]);
    if (JS_IsException(val))
      return val;
    switch (JS_VALUE_GET_TAG(val)) {
      case JS_TAG_SHORT_BIG_INT:
        val = JS_NewInt64(ctx, JS_VALUE_GET_SHORT_BIG_INT(val));
        if (JS_IsException(val))
          return val;
        break;
      case JS_TAG_BIG_INT: {
        JSBigInt* p = JS_VALUE_GET_PTR(val);
        double d;
        d = js_bigint_to_float64(ctx, p);
        JS_FreeValue(ctx, val);
        val = JS_NewFloat64(ctx, d);
      } break;
      default:
        break;
    }
  }
  if (!JS_IsUndefined(new_target)) {
    obj = js_create_from_ctor(ctx, new_target, JS_CLASS_NUMBER);
    if (!JS_IsException(obj))
      JS_SetObjectData(ctx, obj, val);
    return obj;
  } else {
    return val;
  }
}

#if 0
JSValue js_number___toInteger(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
  return JS_ToIntegerFree(ctx, JS_DupValue(ctx, argv[0]));
}

JSValue js_number___toLength(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
  int64_t v;
  if (JS_ToLengthFree(ctx, &v, JS_DupValue(ctx, argv[0])))
      return JS_EXCEPTION;
  return JS_NewInt64(ctx, v);
}
#endif

JSValue js_number_isNaN(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv) {
  if (!JS_IsNumber(argv[0]))
    return JS_FALSE;
  return js_global_isNaN(ctx, this_val, argc, argv);
}

JSValue js_number_isFinite(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv) {
  if (!JS_IsNumber(argv[0]))
    return JS_FALSE;
  return js_global_isFinite(ctx, this_val, argc, argv);
}

JSValue js_number_isInteger(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv) {
  int ret;
  ret = JS_NumberIsInteger(ctx, argv[0]);
  if (ret < 0)
    return JS_EXCEPTION;
  else
    return JS_NewBool(ctx, ret);
}

JSValue js_number_isSafeInteger(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv) {
  double d;
  if (!JS_IsNumber(argv[0]))
    return JS_FALSE;
  if (unlikely(JS_ToFloat64(ctx, &d, argv[0])))
    return JS_EXCEPTION;
  return JS_NewBool(ctx, is_safe_integer(d));
}

JSValue js_thisNumberValue(JSContext* ctx, JSValueConst this_val) {
  if (JS_IsNumber(this_val))
    return JS_DupValue(ctx, this_val);

  if (JS_VALUE_GET_TAG(this_val) == JS_TAG_OBJECT) {
    JSObject* p = JS_VALUE_GET_OBJ(this_val);
    if (p->class_id == JS_CLASS_NUMBER) {
      if (JS_IsNumber(p->u.object_data))
        return JS_DupValue(ctx, p->u.object_data);
    }
  }
  return JS_ThrowTypeError(ctx, "not a number");
}

JSValue js_number_valueOf(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv) {
  return js_thisNumberValue(ctx, this_val);
}

int js_get_radix(JSContext* ctx, JSValueConst val) {
  int radix;
  if (JS_ToInt32Sat(ctx, &radix, val))
    return -1;
  if (radix < 2 || radix > 36) {
    JS_ThrowRangeError(ctx, "radix must be between 2 and 36");
    return -1;
  }
  return radix;
}

JSValue js_number_toString(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv,
    int magic) {
  JSValue val;
  int base, flags;
  double d;

  val = js_thisNumberValue(ctx, this_val);
  if (JS_IsException(val))
    return val;
  if (magic || JS_IsUndefined(argv[0])) {
    base = 10;
  } else {
    base = js_get_radix(ctx, argv[0]);
    if (base < 0)
      goto fail;
  }
  if (JS_VALUE_GET_TAG(val) == JS_TAG_INT) {
    char buf1[70];
    int len;
    len = i64toa_radix(buf1, JS_VALUE_GET_INT(val), base);
    return js_new_string8_len(ctx, buf1, len);
  }
  if (JS_ToFloat64Free(ctx, &d, val))
    return JS_EXCEPTION;
  flags = JS_DTOA_FORMAT_FREE;
  if (base != 10)
    flags |= JS_DTOA_EXP_DISABLED;
  return js_dtoa2(ctx, d, base, 0, flags);
fail:
  JS_FreeValue(ctx, val);
  return JS_EXCEPTION;
}

JSValue js_number_toFixed(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv) {
  JSValue val;
  int f, flags;
  double d;

  val = js_thisNumberValue(ctx, this_val);
  if (JS_IsException(val))
    return val;
  if (JS_ToFloat64Free(ctx, &d, val))
    return JS_EXCEPTION;
  if (JS_ToInt32Sat(ctx, &f, argv[0]))
    return JS_EXCEPTION;
  if (f < 0 || f > 100)
    return JS_ThrowRangeError(ctx, "invalid number of digits");
  if (fabs(d) >= 1e21)
    flags = JS_DTOA_FORMAT_FREE;
  else
    flags = JS_DTOA_FORMAT_FRAC;
  return js_dtoa2(ctx, d, 10, f, flags);
}

JSValue js_number_toExponential(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv) {
  JSValue val;
  int f, flags;
  double d;

  val = js_thisNumberValue(ctx, this_val);
  if (JS_IsException(val))
    return val;
  if (JS_ToFloat64Free(ctx, &d, val))
    return JS_EXCEPTION;
  if (JS_ToInt32Sat(ctx, &f, argv[0]))
    return JS_EXCEPTION;
  if (!isfinite(d)) {
    return JS_ToStringFree(ctx, __JS_NewFloat64(ctx, d));
  }
  if (JS_IsUndefined(argv[0])) {
    flags = JS_DTOA_FORMAT_FREE;
    f = 0;
  } else {
    if (f < 0 || f > 100)
      return JS_ThrowRangeError(ctx, "invalid number of digits");
    f++;
    flags = JS_DTOA_FORMAT_FIXED;
  }
  return js_dtoa2(ctx, d, 10, f, flags | JS_DTOA_EXP_ENABLED);
}

JSValue js_number_toPrecision(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv) {
  JSValue val;
  int p;
  double d;

  val = js_thisNumberValue(ctx, this_val);
  if (JS_IsException(val))
    return val;
  if (JS_ToFloat64Free(ctx, &d, val))
    return JS_EXCEPTION;
  if (JS_IsUndefined(argv[0]))
    goto to_string;
  if (JS_ToInt32Sat(ctx, &p, argv[0]))
    return JS_EXCEPTION;
  if (!isfinite(d)) {
  to_string:
    return JS_ToStringFree(ctx, __JS_NewFloat64(ctx, d));
  }
  if (p < 1 || p > 100)
    return JS_ThrowRangeError(ctx, "invalid number of digits");
  return js_dtoa2(ctx, d, 10, p, JS_DTOA_FORMAT_FIXED);
}

JSValue js_parseInt(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv) {
  const char *str, *p;
  int radix, flags;
  JSValue ret;

  str = JS_ToCString(ctx, argv[0]);
  if (!str)
    return JS_EXCEPTION;
  if (JS_ToInt32(ctx, &radix, argv[1])) {
    JS_FreeCString(ctx, str);
    return JS_EXCEPTION;
  }
  if (radix != 0 && (radix < 2 || radix > 36)) {
    ret = JS_NAN;
  } else {
    p = str;
    p += skip_spaces(p);
    flags = ATOD_INT_ONLY | ATOD_ACCEPT_PREFIX_AFTER_SIGN;
    ret = js_atof(ctx, p, NULL, radix, flags);
  }
  JS_FreeCString(ctx, str);
  return ret;
}

JSValue js_parseFloat(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv) {
  const char *str, *p;
  JSValue ret;

  str = JS_ToCString(ctx, argv[0]);
  if (!str)
    return JS_EXCEPTION;
  p = str;
  p += skip_spaces(p);
  ret = js_atof(ctx, p, NULL, 10, 0);
  JS_FreeCString(ctx, str);
  return ret;
}
