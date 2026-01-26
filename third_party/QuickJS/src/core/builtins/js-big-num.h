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

#include "../types.h"
#include "QuickJS/cutils.h"
#include "QuickJS/dtoa.h"
#include "QuickJS/quickjs.h"

#ifdef __cplusplus
extern "C" {
#endif

JSValue JS_ToBigIntFree(JSContext* ctx, JSValue val);
JSValue JS_ToBigInt(JSContext* ctx, JSValueConst val);
int JS_ToBigInt64Free(JSContext* ctx, int64_t* pres, JSValue val);
__maybe_unused JSValue JS_ToBigIntValueFree(JSContext* ctx, JSValue val);

no_inline __exception int
js_unary_arith_slow(JSContext* ctx, JSValue* sp, OPCodeEnum op);
__exception int js_post_inc_slow(JSContext* ctx, JSValue* sp, OPCodeEnum op);

BOOL tag_is_number(uint32_t tag);
BOOL tag_is_string(uint32_t tag);

no_inline __exception int js_add_slow(JSContext* ctx, JSValue* sp);
no_inline __exception int
js_binary_arith_slow(JSContext* ctx, JSValue* sp, OPCodeEnum op);
no_inline __exception int
js_binary_logic_slow(JSContext* ctx, JSValue* sp, OPCodeEnum op);
no_inline int js_not_slow(JSContext* ctx, JSValue* sp);
no_inline int js_relational_slow(JSContext* ctx, JSValue* sp, OPCodeEnum op);
no_inline __exception int js_eq_slow(JSContext* ctx, JSValue* sp, BOOL is_neq);
no_inline int js_shr_slow(JSContext* ctx, JSValue* sp);

JSBigInt* js_bigint_new(JSContext* ctx, int len);
JSBigInt* js_bigint_set_si(JSBigIntBuf* buf, js_slimb_t a);
JSBigInt* js_bigint_set_short(JSBigIntBuf* buf, JSValueConst val);
JSBigInt* js_bigint_new_si64(JSContext* ctx, int64_t a);
JSBigInt* js_bigint_new_ui64(JSContext* ctx, uint64_t a);
JSBigInt* js_bigint_new_di(JSContext* ctx, js_sdlimb_t a);
int js_bigint_sign(const JSBigInt* a);
js_slimb_t js_bigint_get_si_sat(const JSBigInt* a);
JSBigInt*
js_bigint_add(JSContext* ctx, const JSBigInt* a, const JSBigInt* b, int b_neg);
JSBigInt* js_bigint_neg(JSContext* ctx, const JSBigInt* a);
JSBigInt* js_bigint_mul(JSContext* ctx, const JSBigInt* a, const JSBigInt* b);
JSBigInt* js_bigint_divrem(
    JSContext* ctx,
    const JSBigInt* a,
    const JSBigInt* b,
    BOOL is_rem);
JSBigInt* js_bigint_logic(
    JSContext* ctx,
    const JSBigInt* a,
    const JSBigInt* b,
    OPCodeEnum op);
JSBigInt* js_bigint_not(JSContext* ctx, const JSBigInt* a);
JSBigInt* js_bigint_shl(JSContext* ctx, const JSBigInt* a, unsigned int shift1);
JSBigInt* js_bigint_shr(JSContext* ctx, const JSBigInt* a, unsigned int shift1);
JSBigInt* js_bigint_pow(JSContext* ctx, const JSBigInt* a, JSBigInt* b);
double js_bigint_to_float64(JSContext* ctx, const JSBigInt* a);
int js_bigint_float64_cmp(JSContext* ctx, const JSBigInt* a, double b);
JSBigInt* js_bigint_from_float64(JSContext* ctx, int* pres, double a1);
int js_bigint_cmp(JSContext* ctx, const JSBigInt* a, const JSBigInt* b);

JSBigInt* js_bigint_from_string(JSContext* ctx, const char* str, int radix);
JSValue js_bigint_to_string1(JSContext* ctx, JSValueConst val, int radix);
JSValue js_bigint_to_string(JSContext* ctx, JSValueConst val);
JSValue JS_CompactBigInt(JSContext* ctx, JSBigInt* p);

void JS_AddIntrinsicBigInt(JSContext* ctx);

#ifdef __cplusplus
} /* end of extern "C" */
#endif
