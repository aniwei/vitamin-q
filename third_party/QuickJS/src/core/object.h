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
#include "ic.h"
#include "shape.h"
#include "types.h"

#ifdef __cplusplus
extern "C" {
#endif

JSValue
JS_GetPropertyValue(JSContext* ctx, JSValueConst this_obj, JSValue prop);

/* Check if an object has a generalized numeric property. Return value:
   -1 for exception,
   TRUE if property exists, stored into *pval,
   FALSE if proprty does not exist.
 */
int JS_TryGetPropertyInt64(
    JSContext* ctx,
    JSValueConst obj,
    int64_t idx,
    JSValue* pval);
JSValue JS_GetPropertyInt64(JSContext* ctx, JSValueConst obj, int64_t idx);

/* can be called on Array or Arguments objects. return < 0 if
   memory alloc error. */
no_inline __exception int convert_fast_array_to_array(
    JSContext* ctx,
    JSObject* p);

int delete_property(JSContext* ctx, JSObject* p, JSAtom atom);
int call_setter(
    JSContext* ctx,
    JSObject* setter,
    JSValueConst this_obj,
    JSValue val,
    int flags);
void free_property(JSRuntime* rt, JSProperty* pr, int prop_flags);
JSProperty*
add_property(JSContext* ctx, JSObject* p, JSAtom prop, int prop_flags);

/* return FALSE if not OK */
BOOL check_define_prop_flags(int prop_flags, int flags);
void JS_FreePropertyEnum(JSContext* ctx, JSPropertyEnum* tab, uint32_t len);
void js_free_desc(JSContext* ctx, JSPropertyDescriptor* desc);

JSValue js_instantiate_prototype(
    JSContext* ctx,
    JSObject* p,
    JSAtom atom,
    void* opaque);
JSValue js_create_from_ctor(JSContext* ctx, JSValueConst ctor, int class_id);

__exception int JS_CopyDataProperties(
    JSContext* ctx,
    JSValueConst target,
    JSValueConst source,
    JSValueConst excluded,
    BOOL setprop);

int JS_DefinePropertyValueValue(
    JSContext* ctx,
    JSValueConst this_obj,
    JSValue prop,
    JSValue val,
    int flags);
int JS_DefinePropertyValueInt64(
    JSContext* ctx,
    JSValueConst this_obj,
    int64_t idx,
    JSValue val,
    int flags);
/* flags can be JS_PROP_THROW or JS_PROP_THROW_STRICT */
int JS_SetPropertyValue(
    JSContext* ctx,
    JSValueConst this_obj,
    JSValue prop,
    JSValue val,
    int flags);

/* return -1 if exception (Proxy object only) or TRUE/FALSE */
int JS_IsExtensible(JSContext* ctx, JSValueConst obj);

/* return -1 if exception (Proxy object only) or TRUE/FALSE */
int JS_PreventExtensions(JSContext* ctx, JSValueConst obj);

JSValue
JS_GetOwnPropertyNames2(JSContext* ctx, JSValueConst obj1, int flags, int kind);
/* return -1 if exception otherwise TRUE or FALSE */
int JS_HasProperty(JSContext* ctx, JSValueConst obj, JSAtom prop);

/* Private fields can be added even on non extensible objects or
   Proxies */
int JS_DefinePrivateField(
    JSContext* ctx,
    JSValueConst obj,
    JSValueConst name,
    JSValue val);

JSValue JS_GetPrivateField(JSContext* ctx, JSValueConst obj, JSValueConst name);

int JS_SetPrivateField(
    JSContext* ctx,
    JSValueConst obj,
    JSValueConst name,
    JSValue val);

int JS_AddBrand(JSContext* ctx, JSValueConst obj, JSValueConst home_obj);
int JS_CheckBrand(JSContext* ctx, JSValueConst obj, JSValueConst func);

uint32_t js_string_obj_get_length(JSContext* ctx, JSValueConst obj);

/* return < 0 in case if exception, 0 if OK. ptab and its atoms must
   be freed by the user. */
int __exception JS_GetOwnPropertyNamesInternal(
    JSContext* ctx,
    JSPropertyEnum** ptab,
    uint32_t* plen,
    JSObject* p,
    int flags);
/* Return -1 if exception,
   FALSE if the property does not exist, TRUE if it exists. If TRUE is
   returned, the property descriptor 'desc' is filled present. */
int JS_GetOwnPropertyInternal(
    JSContext* ctx,
    JSPropertyDescriptor* desc,
    JSObject* p,
    JSAtom prop);

int JS_CreateDataPropertyUint32(
    JSContext* ctx,
    JSValueConst this_obj,
    int64_t idx,
    JSValue val,
    int flags);

int JS_GetOwnProperty(
    JSContext* ctx,
    JSPropertyDescriptor* desc,
    JSValueConst obj,
    JSAtom prop);

int JS_DefineAutoInitProperty(
    JSContext* ctx,
    JSValueConst this_obj,
    JSAtom prop,
    JSAutoInitIDEnum id,
    void* opaque,
    int flags);

/* return TRUE if 'obj' has a non empty 'name' string */
BOOL js_object_has_name(JSContext* ctx, JSValueConst obj);
int JS_DefineObjectName(
    JSContext* ctx,
    JSValueConst obj,
    JSAtom name,
    int flags);
int JS_DefineObjectNameComputed(
    JSContext* ctx,
    JSValueConst obj,
    JSValueConst str,
    int flags);

int JS_SetObjectData(JSContext* ctx, JSValueConst obj, JSValue val);

#ifdef __cplusplus
} /* end of extern "C" */
#endif

static force_inline JSShapeProperty* find_own_property1(
    JSObject* p,
    JSAtom atom) {
  JSShape* sh;
  JSShapeProperty *pr, *prop;
  intptr_t h;
  sh = p->shape;
  h = (uintptr_t)atom & sh->prop_hash_mask;
  h = prop_hash_end(sh)[-h - 1];
  prop = get_shape_prop(sh);
  while (h) {
    pr = &prop[h - 1];
    if (likely(pr->atom == atom)) {
      return pr;
    }
    h = pr->hash_next;
  }
  return NULL;
};

static force_inline JSShapeProperty*
find_own_property(JSProperty** ppr, JSObject* p, JSAtom atom) {
  JSShape* sh;
  JSShapeProperty *pr, *prop;
  intptr_t h;
  sh = p->shape;
  h = (uintptr_t)atom & sh->prop_hash_mask;
  h = prop_hash_end(sh)[-h - 1];
  prop = get_shape_prop(sh);
  while (h) {
    pr = &prop[h - 1];
    if (likely(pr->atom == atom)) {
      *ppr = &p->prop[h - 1];
      /* the compiler should be able to assume that pr != NULL here */
      return pr;
    }
    h = pr->hash_next;
  }
  *ppr = NULL;
  return NULL;
};

static force_inline JSShapeProperty* find_own_property_ic(
    JSProperty** ppr,
    JSObject* p,
    JSAtom atom,
    uint32_t* offset) {
  JSShape* sh;
  JSShapeProperty *pr, *prop;
  intptr_t h;
  sh = p->shape;
  h = (uintptr_t)atom & sh->prop_hash_mask;
  h = prop_hash_end(sh)[-h - 1];
  prop = get_shape_prop(sh);
  while (h) {
    pr = &prop[h - 1];
    if (likely(pr->atom == atom)) {
      *ppr = &p->prop[h - 1];
      *offset = h - 1;
      /* the compiler should be able to assume that pr != NULL here */
      return pr;
    }
    h = pr->hash_next;
  }
  *ppr = NULL;
  return NULL;
}

/* set the new value and free the old value after (freeing the value
   can reallocate the object data) */
static inline void set_value(JSContext* ctx, JSValue* pval, JSValue new_val) {
  JSValue old_val;
  old_val = *pval;
  *pval = new_val;
  JS_FreeValue(ctx, old_val);
}

static force_inline JSValue JS_GetPropertyInternalWithIC(
    JSContext* ctx,
    JSValueConst obj,
    JSAtom prop,
    JSValueConst this_obj,
    BOOL throw_ref_error,
    InlineCache* ic,
    int32_t offset) {
  uint32_t tag;
  JSObject *p, *proto;
  tag = JS_VALUE_GET_TAG(obj);
  if (unlikely(tag != JS_TAG_OBJECT))
    goto slow_path;
  p = JS_VALUE_GET_OBJ(obj);
  offset = get_ic_prop_offset(ic, offset, p->shape, &proto);
  if (likely(offset >= 0)) {
    if (proto)
      p = proto;
    return JS_DupValue(ctx, p->prop[offset].u.value);
  }
slow_path:
  return JS_GetPropertyInternal(ctx, obj, prop, this_obj, throw_ref_error, ic);
}

static force_inline int JS_SetPropertyInternalWithIC(
    JSContext* ctx,
    JSValueConst obj,
    JSAtom prop,
    JSValue val,
    JSValueConst this_obj,
    int flags,
    InlineCache* ic,
    int32_t offset) {
  uint32_t tag;
  JSObject *p, *proto;
  tag = JS_VALUE_GET_TAG(obj);
  if (unlikely(tag != JS_TAG_OBJECT))
    goto slow_path;
  p = JS_VALUE_GET_OBJ(obj);
  offset = get_ic_prop_offset(ic, offset, p->shape, &proto);
  if (likely(offset >= 0)) {
    if (proto)
      p = proto;
    set_value(ctx, &p->prop[offset].u.value, val);
    return TRUE;
  }
slow_path:
  return JS_SetPropertyInternal(ctx, obj, prop, val, this_obj, flags, ic);
}
