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
#include "QuickJS/quickjs.h"

#define PROMISE_MAGIC_all 0
#define PROMISE_MAGIC_allSettled 1
#define PROMISE_MAGIC_any 2

#ifdef __cplusplus
extern "C" {
#endif

JSValue js_promise_then(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv);
JSValue js_promise_catch(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv);
JSValue js_promise_finally(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv);
JSValue js_new_promise_capability(
    JSContext* ctx,
    JSValue* resolving_funcs,
    JSValueConst ctor);
JSValue js_promise_resolve(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv,
    int magic);
JSValue js_promise_all(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv,
    int magic);
JSValue js_promise_race(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv);
JSValue js_promise_constructor(
    JSContext* ctx,
    JSValueConst new_target,
    int argc,
    JSValueConst* argv);
JSValue js_promise_withResolvers(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv);

__exception int perform_promise_then(
    JSContext* ctx,
    JSValueConst promise,
    JSValueConst* resolve_reject,
    JSValueConst* cap_resolving_funcs);

JSValue js_promise_executor(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv,
    int magic,
    JSValue* func_data);
JSValue js_promise_executor_new(JSContext* ctx);
JSPromiseStateEnum JS_PromiseState(JSContext* ctx, JSValue promise);
JSValue JS_PromiseResult(JSContext* ctx, JSValue promise);

void js_promise_set_opaque(JSContext* ctx, JSValue promise, void* opaque);
void* js_promise_get_opaque(JSContext* ctx, JSValue promise);


#ifdef __cplusplus
} /* end of extern "C" */
#endif
