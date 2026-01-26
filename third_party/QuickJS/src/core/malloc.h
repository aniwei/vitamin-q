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
#include "types.h"

#if ENABLE_MI_MALLOC
#include <mimalloc.h>

// Standard C allocation
#define malloc(n) mi_malloc(n)
#define calloc(n, c) mi_calloc(n, c)
#define realloc(p, n) mi_realloc(p, n)
#define free(p) mi_free(p)

#define strdup(s) mi_strdup(s)
#define strndup(s, n) mi_strndup(s, n)
#define realpath(f, n) mi_realpath(f, n)

// Microsoft extensions
#define _expand(p, n) mi_expand(p, n)
#define _msize(p) mi_usable_size(p)
#define _recalloc(p, n, c) mi_recalloc(p, n, c)

#define _strdup(s) mi_strdup(s)
#define _strndup(s, n) mi_strndup(s, n)
#define _wcsdup(s) (wchar_t*)mi_wcsdup((const unsigned short*)(s))
#define _mbsdup(s) mi_mbsdup(s)
#define _dupenv_s(b, n, v) mi_dupenv_s(b, n, v)
#define _wdupenv_s(b, n, v) \
  mi_wdupenv_s((unsigned short*)(b), n, (const unsigned short*)(v))

// Various Posix and Unix variants
#define reallocf(p, n) mi_reallocf(p, n)
#define malloc_size(p) mi_usable_size(p)
#define malloc_usable_size(p) mi_usable_size(p)
#define cfree(p) mi_free(p)

#define valloc(n) mi_valloc(n)
#define pvalloc(n) mi_pvalloc(n)
#define reallocarray(p, s, n) mi_reallocarray(p, s, n)
#define reallocarr(p, s, n) mi_reallocarr(p, s, n)
#define memalign(a, n) mi_memalign(a, n)
#define aligned_alloc(a, n) mi_aligned_alloc(a, n)
#define posix_memalign(p, a, n) mi_posix_memalign(p, a, n)
#define _posix_memalign(p, a, n) mi_posix_memalign(p, a, n)

// Microsoft aligned variants
#define _aligned_malloc(n, a) mi_malloc_aligned(n, a)
#define _aligned_realloc(p, n, a) mi_realloc_aligned(p, n, a)
#define _aligned_recalloc(p, s, n, a) mi_aligned_recalloc(p, s, n, a)
#define _aligned_msize(p, a, o) mi_usable_size(p)
#define _aligned_free(p) mi_free(p)
#define _aligned_offset_malloc(n, a, o) mi_malloc_aligned_at(n, a, o)
#define _aligned_offset_realloc(p, n, a, o) mi_realloc_aligned_at(p, n, a, o)
#define _aligned_offset_recalloc(p, s, n, a, o) \
  mi_recalloc_aligned_at(p, s, n, a, o)
#else
#if defined(__APPLE__)
#include <malloc/malloc.h>
#elif defined(__linux__) || defined(__GLIBC__)
#include <malloc.h>
#elif defined(__FreeBSD__)
#include <malloc_np.h>
#endif
#endif

#ifdef __cplusplus
extern "C" {
#endif

void js_trigger_gc(JSRuntime* rt, size_t size);
no_inline int js_realloc_array(
    JSContext* ctx,
    void** parray,
    int elem_size,
    int* psize,
    int req_size);

/* resize the array and update its size if req_size > *psize */
static inline int js_resize_array(
    JSContext* ctx,
    void** parray,
    int elem_size,
    int* psize,
    int req_size) {
  if (unlikely(req_size > *psize))
    return js_realloc_array(ctx, parray, elem_size, psize, req_size);
  else
    return 0;
}

static inline void js_dbuf_init(JSContext* ctx, DynBuf* s) {
  dbuf_init2(s, ctx->rt, (DynBufReallocFunc*)js_realloc_rt);
}

void* js_def_malloc(JSMallocState* s, size_t size);
void js_def_free(JSMallocState* s, void* ptr);
void* js_def_realloc(JSMallocState* s, void* ptr, size_t size);
size_t js_def_malloc_usable_size(const void* ptr);
size_t js_malloc_usable_size_unknown(const void* ptr);

void* js_bf_realloc(void* opaque, void* ptr, size_t size);

#ifdef __cplusplus
} /* extern "C" { */
#endif
