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

#pragma once

#include "QuickJS/cutils.h"
#include "QuickJS/quickjs.h"
#include "common.h"
#include "types.h"

#define HINT_STRING 0
#define HINT_NUMBER 1
#define HINT_NONE 2
/* don't try Symbol.toPrimitive */
#define HINT_FORCE_ORDINARY (1 << 4)

#define MAX_SAFE_INTEGER (((int64_t)1 << 53) - 1)
typedef enum JSToNumberHintEnum {
  TON_FLAG_NUMBER,
  TON_FLAG_NUMERIC,
} JSToNumberHintEnum;

#ifdef __cplusplus
extern "C" {
#endif

int skip_spaces(const char* pc);
JSValue JS_ToPrimitiveFree(JSContext* ctx, JSValue val, int hint);
JSValue JS_ToPrimitive(JSContext* ctx, JSValueConst val, int hint);

__exception int JS_ToArrayLengthFree(
    JSContext* ctx,
    uint32_t* plen,
    JSValue val,
    BOOL is_array_ctor);

JSValue JS_ToNumberFree(JSContext* ctx, JSValue val);
JSValue JS_ToNumericFree(JSContext* ctx, JSValue val);
JSValue JS_ToNumeric(JSContext* ctx, JSValueConst val);
__exception int __JS_ToFloat64Free(JSContext* ctx, double* pres, JSValue val);
/* same as JS_ToNumber() but return 0 in case of NaN/Undefined */
__maybe_unused JSValue JS_ToIntegerFree(JSContext* ctx, JSValue val);
/* Note: the integer value is satured to 32 bits */
int JS_ToInt32SatFree(JSContext* ctx, int* pres, JSValue val);
int JS_ToInt32Sat(JSContext* ctx, int* pres, JSValueConst val);
int JS_ToInt32Clamp(
    JSContext* ctx,
    int* pres,
    JSValueConst val,
    int min,
    int max,
    int min_offset);
int JS_ToInt64SatFree(JSContext* ctx, int64_t* pres, JSValue val);
int JS_ToInt64Sat(JSContext* ctx, int64_t* pres, JSValueConst val);
int JS_ToInt64Clamp(
    JSContext* ctx,
    int64_t* pres,
    JSValueConst val,
    int64_t min,
    int64_t max,
    int64_t neg_offset);
/* Same as JS_ToInt32Free() but with a 64 bit result. Return (<0, 0)
   in case of exception */
int JS_ToInt64Free(JSContext* ctx, int64_t* pres, JSValue val);
JSValue JS_ToNumber(JSContext* ctx, JSValueConst val);

JSValue JS_ToStringFree(JSContext* ctx, JSValue val);
int JS_ToBoolFree(JSContext* ctx, JSValue val);
int JS_ToBool(JSContext* ctx, JSValueConst val);
JSValue
js_atof(JSContext* ctx, const char* str, const char** pp, int radix, int flags);

int JS_ToInt32Free(JSContext* ctx, int32_t* pres, JSValue val);
static inline int JS_ToFloat64Free(JSContext* ctx, double* pres, JSValue val) {
  uint32_t tag;

  tag = JS_VALUE_GET_TAG(val);
  if (tag <= JS_TAG_NULL) {
    *pres = JS_VALUE_GET_INT(val);
    return 0;
  } else if (JS_TAG_IS_FLOAT64(tag)) {
    *pres = JS_VALUE_GET_FLOAT64(val);
    return 0;
  } else {
    return __JS_ToFloat64Free(ctx, pres, val);
  }
}

static inline int JS_ToUint32Free(JSContext* ctx, uint32_t* pres, JSValue val) {
  return JS_ToInt32Free(ctx, (int32_t*)pres, val);
}
int JS_ToUint8ClampFree(JSContext* ctx, int32_t* pres, JSValue val);

static inline int to_digit(int c) {
  if (c >= '0' && c <= '9')
    return c - '0';
  else if (c >= 'A' && c <= 'Z')
    return c - 'A' + 10;
  else if (c >= 'a' && c <= 'z')
    return c - 'a' + 10;
  else
    return 36;
}
JSValue
js_atof(JSContext* ctx, const char* str, const char** pp, int radix, int flags);

BOOL is_safe_integer(double d);
/* convert a value to a length between 0 and MAX_SAFE_INTEGER.
   return -1 for exception */
__exception int JS_ToLengthFree(JSContext* ctx, int64_t* plen, JSValue val);
/* Note: can return an exception */
int JS_NumberIsInteger(JSContext* ctx, JSValueConst val);
BOOL JS_NumberIsNegativeOrMinusZero(JSContext* ctx, JSValueConst val);

JSValue js_dtoa2(JSContext* ctx, double d, int radix, int n_digits, int flags);
JSValue
JS_ToStringInternal(JSContext* ctx, JSValueConst val, BOOL is_ToPropertyKey);

JSValue JS_ToLocaleStringFree(JSContext* ctx, JSValue val);
JSValue JS_ToStringCheckObject(JSContext* ctx, JSValueConst val);
JSValue JS_ToQuotedString(JSContext* ctx, JSValueConst val1);

#ifdef __cplusplus
} /* end of extern "C" */
#endif
