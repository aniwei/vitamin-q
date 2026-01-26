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

#include "js-operator.h"

#include "../convertion.h"
#include "../exception.h"
#include "../function.h"
#include "../object.h"
#include "../runtime.h"
#include "../string-utils.h"
#include "js-big-num.h"
#include "js-object.h"

void js_for_in_iterator_finalizer(JSRuntime* rt, JSValue val) {
  JSObject* p = JS_VALUE_GET_OBJ(val);
  JSForInIterator* it = p->u.for_in_iterator;
  int i;

  JS_FreeValueRT(rt, it->obj);
  if (!it->is_array) {
    for (i = 0; i < it->atom_count; i++) {
      JS_FreeAtomRT(rt, it->tab_atom[i].atom);
    }
    js_free_rt(rt, it->tab_atom);
  }
  js_free_rt(rt, it);
}

void js_for_in_iterator_mark(
    JSRuntime* rt,
    JSValueConst val,
    JS_MarkFunc* mark_func) {
  JSObject* p = JS_VALUE_GET_OBJ(val);
  JSForInIterator* it = p->u.for_in_iterator;
  JS_MarkValue(rt, it->obj, mark_func);
}

double js_pow(double a, double b) {
  if (unlikely(!isfinite(b)) && fabs(a) == 1) {
    /* not compatible with IEEE 754 */
    return JS_FLOAT64_NAN;
  } else {
    return pow(a, b);
  }
}

/* XXX: Should take JSValueConst arguments */
BOOL js_strict_eq2(
    JSContext* ctx,
    JSValue op1,
    JSValue op2,
    JSStrictEqModeEnum eq_mode) {
  BOOL res;
  int tag1, tag2;
  double d1, d2;

  tag1 = JS_VALUE_GET_NORM_TAG(op1);
  tag2 = JS_VALUE_GET_NORM_TAG(op2);
  switch (tag1) {
    case JS_TAG_BOOL:
      if (tag1 != tag2) {
        res = FALSE;
      } else {
        res = JS_VALUE_GET_INT(op1) == JS_VALUE_GET_INT(op2);
        goto done_no_free;
      }
      break;
    case JS_TAG_NULL:
    case JS_TAG_UNDEFINED:
      res = (tag1 == tag2);
      break;
    case JS_TAG_STRING:
    case JS_TAG_STRING_ROPE: {
      if (!tag_is_string(tag2)) {
        res = FALSE;
      } else if (tag1 == JS_TAG_STRING && tag2 == JS_TAG_STRING) {
        res =
            (js_string_compare(
                 ctx, JS_VALUE_GET_STRING(op1), JS_VALUE_GET_STRING(op2)) == 0);
      } else {
        res = (js_string_rope_compare(ctx, op1, op2, TRUE) == 0);
      }
    } break;
    case JS_TAG_SYMBOL: {
      JSAtomStruct *p1, *p2;
      if (tag1 != tag2) {
        res = FALSE;
      } else {
        p1 = JS_VALUE_GET_PTR(op1);
        p2 = JS_VALUE_GET_PTR(op2);
        res = (p1 == p2);
      }
    } break;
    case JS_TAG_OBJECT:
      if (tag1 != tag2)
        res = FALSE;
      else
        res = JS_VALUE_GET_OBJ(op1) == JS_VALUE_GET_OBJ(op2);
      break;
    case JS_TAG_INT:
      d1 = JS_VALUE_GET_INT(op1);
      if (tag2 == JS_TAG_INT) {
        d2 = JS_VALUE_GET_INT(op2);
        goto number_test;
      } else if (tag2 == JS_TAG_FLOAT64) {
        d2 = JS_VALUE_GET_FLOAT64(op2);
        goto number_test;
      } else {
        res = FALSE;
      }
      break;
    case JS_TAG_FLOAT64:
      d1 = JS_VALUE_GET_FLOAT64(op1);
      if (tag2 == JS_TAG_FLOAT64) {
        d2 = JS_VALUE_GET_FLOAT64(op2);
      } else if (tag2 == JS_TAG_INT) {
        d2 = JS_VALUE_GET_INT(op2);
      } else {
        res = FALSE;
        break;
      }
    number_test:
      if (unlikely(eq_mode >= JS_EQ_SAME_VALUE)) {
        JSFloat64Union u1, u2;
        /* NaN is not always normalized, so this test is necessary */
        if (isnan(d1) || isnan(d2)) {
          res = isnan(d1) == isnan(d2);
        } else if (eq_mode == JS_EQ_SAME_VALUE_ZERO) {
          res = (d1 == d2); /* +0 == -0 */
        } else {
          u1.d = d1;
          u2.d = d2;
          res = (u1.u64 == u2.u64); /* +0 != -0 */
        }
      } else {
        res = (d1 == d2); /* if NaN return false and +0 == -0 */
      }
      goto done_no_free;
    case JS_TAG_SHORT_BIG_INT:
    case JS_TAG_BIG_INT: {
      JSBigIntBuf buf1, buf2;
      JSBigInt *p1, *p2;

      if (tag2 != JS_TAG_SHORT_BIG_INT && tag2 != JS_TAG_BIG_INT) {
        res = FALSE;
        break;
      }

      if (JS_VALUE_GET_TAG(op1) == JS_TAG_SHORT_BIG_INT)
        p1 = js_bigint_set_short(&buf1, op1);
      else
        p1 = JS_VALUE_GET_PTR(op1);
      if (JS_VALUE_GET_TAG(op2) == JS_TAG_SHORT_BIG_INT)
        p2 = js_bigint_set_short(&buf2, op2);
      else
        p2 = JS_VALUE_GET_PTR(op2);
      res = (js_bigint_cmp(ctx, p1, p2) == 0);
    } break;
    default:
      res = FALSE;
      break;
  }
  JS_FreeValue(ctx, op1);
  JS_FreeValue(ctx, op2);
done_no_free:
  return res;
}

BOOL js_strict_eq(JSContext* ctx, JSValueConst op1, JSValueConst op2) {
  return js_strict_eq2(
      ctx, JS_DupValue(ctx, op1), JS_DupValue(ctx, op2), JS_EQ_STRICT);
}

BOOL JS_StrictEq(JSContext* ctx, JSValueConst op1, JSValueConst op2) {
  return js_strict_eq(ctx, op1, op2);
}

BOOL js_same_value(JSContext* ctx, JSValueConst op1, JSValueConst op2) {
  return js_strict_eq2(
      ctx, JS_DupValue(ctx, op1), JS_DupValue(ctx, op2), JS_EQ_SAME_VALUE);
}

BOOL JS_SameValue(JSContext* ctx, JSValueConst op1, JSValueConst op2) {
  return js_same_value(ctx, op1, op2);
}

BOOL js_same_value_zero(JSContext* ctx, JSValueConst op1, JSValueConst op2) {
  return js_strict_eq2(
      ctx, JS_DupValue(ctx, op1), JS_DupValue(ctx, op2), JS_EQ_SAME_VALUE_ZERO);
}

BOOL JS_SameValueZero(JSContext* ctx, JSValueConst op1, JSValueConst op2) {
  return js_same_value_zero(ctx, op1, op2);
}

no_inline int js_strict_eq_slow(JSContext* ctx, JSValue* sp, BOOL is_neq) {
  BOOL res;
  res = js_strict_eq2(ctx, sp[-2], sp[-1], JS_EQ_STRICT);
  sp[-2] = JS_NewBool(ctx, res ^ is_neq);
  return 0;
}

__exception int js_operator_in(JSContext* ctx, JSValue* sp) {
  JSValue op1, op2;
  JSAtom atom;
  int ret;

  op1 = sp[-2];
  op2 = sp[-1];

  if (JS_VALUE_GET_TAG(op2) != JS_TAG_OBJECT) {
    JS_ThrowTypeError(ctx, "invalid 'in' operand");
    return -1;
  }
  atom = JS_ValueToAtom(ctx, op1);
  if (unlikely(atom == JS_ATOM_NULL))
    return -1;
  ret = JS_HasProperty(ctx, op2, atom);
  JS_FreeAtom(ctx, atom);
  if (ret < 0)
    return -1;
  JS_FreeValue(ctx, op1);
  JS_FreeValue(ctx, op2);
  sp[-2] = JS_NewBool(ctx, ret);
  return 0;
}

__exception int
js_has_unscopable(JSContext* ctx, JSValueConst obj, JSAtom atom) {
  JSValue arr, val;
  int ret;

  arr = JS_GetProperty(ctx, obj, JS_ATOM_Symbol_unscopables);
  if (JS_IsException(arr))
    return -1;
  ret = 0;
  if (JS_IsObject(arr)) {
    val = JS_GetProperty(ctx, arr, atom);
    ret = JS_ToBoolFree(ctx, val);
  }
  JS_FreeValue(ctx, arr);
  return ret;
}

__exception int js_operator_private_in(JSContext* ctx, JSValue* sp) {
  JSValue op1, op2;
  int ret;

  op1 = sp[-2]; /* object */
  op2 = sp[-1]; /* field name or method function */

  if (JS_VALUE_GET_TAG(op1) != JS_TAG_OBJECT) {
    JS_ThrowTypeError(ctx, "invalid 'in' operand");
    return -1;
  }
  if (JS_IsObject(op2)) {
    /* method: use the brand */
    ret = JS_CheckBrand(ctx, op1, op2);
    if (ret < 0)
      return -1;
  } else {
    JSAtom atom;
    JSObject* p;
    JSShapeProperty* prs;
    JSProperty* pr;
    /* field */
    atom = JS_ValueToAtom(ctx, op2);
    if (unlikely(atom == JS_ATOM_NULL))
      return -1;
    p = JS_VALUE_GET_OBJ(op1);
    prs = find_own_property(&pr, p, atom);
    JS_FreeAtom(ctx, atom);
    ret = (prs != NULL);
  }
  JS_FreeValue(ctx, op1);
  JS_FreeValue(ctx, op2);
  sp[-2] = JS_NewBool(ctx, ret);
  return 0;
}

__exception int js_operator_instanceof(JSContext* ctx, JSValue* sp) {
  JSValue op1, op2;
  BOOL ret;

  op1 = sp[-2];
  op2 = sp[-1];
  ret = JS_IsInstanceOf(ctx, op1, op2);
  if (ret < 0)
    return ret;
  JS_FreeValue(ctx, op1);
  JS_FreeValue(ctx, op2);
  sp[-2] = JS_NewBool(ctx, ret);
  return 0;
}

__exception int js_operator_typeof(JSContext* ctx, JSValueConst op1) {
  JSAtom atom;
  uint32_t tag;

  tag = JS_VALUE_GET_NORM_TAG(op1);
  switch (tag) {
    case JS_TAG_SHORT_BIG_INT:
    case JS_TAG_BIG_INT:
      atom = JS_ATOM_bigint;
      break;
    case JS_TAG_INT:
    case JS_TAG_FLOAT64:
      atom = JS_ATOM_number;
      break;
    case JS_TAG_UNDEFINED:
      atom = JS_ATOM_undefined;
      break;
    case JS_TAG_BOOL:
      atom = JS_ATOM_boolean;
      break;
    case JS_TAG_STRING:
    case JS_TAG_STRING_ROPE:
      atom = JS_ATOM_string;
      break;
    case JS_TAG_OBJECT: {
      JSObject* p;
      p = JS_VALUE_GET_OBJ(op1);
      if (unlikely(p->is_HTMLDDA))
        atom = JS_ATOM_undefined;
      else if (JS_IsFunction(ctx, op1))
        atom = JS_ATOM_function;
      else
        goto obj_type;
    } break;
    case JS_TAG_NULL:
    obj_type:
      atom = JS_ATOM_object;
      break;
    case JS_TAG_SYMBOL:
      atom = JS_ATOM_symbol;
      break;
    default:
      atom = JS_ATOM_unknown;
      break;
  }
  return atom;
}

__exception int js_operator_delete(JSContext* ctx, JSValue* sp) {
  JSValue op1, op2;
  JSAtom atom;
  int ret;

  op1 = sp[-2];
  op2 = sp[-1];
  atom = JS_ValueToAtom(ctx, op2);
  if (unlikely(atom == JS_ATOM_NULL))
    return -1;
  ret = JS_DeleteProperty(ctx, op1, atom, JS_PROP_THROW_STRICT);
  JS_FreeAtom(ctx, atom);
  if (unlikely(ret < 0))
    return -1;
  JS_FreeValue(ctx, op1);
  JS_FreeValue(ctx, op2);
  sp[-2] = JS_NewBool(ctx, ret);
  return 0;
}

/* XXX: not 100% compatible, but mozilla seems to use a similar
   implementation to ensure that caller in non strict mode does not
   throw (ES5 compatibility) */
JSValue js_throw_type_error(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv) {
  JSFunctionBytecode* b = JS_GetFunctionBytecode(this_val);
  if (!b || (b->js_mode & JS_MODE_STRICT) || !b->has_prototype || argc >= 1) {
    return JS_ThrowTypeError(ctx, "invalid property access");
  }
  return JS_UNDEFINED;
}

JSValue js_build_rest(JSContext* ctx, int first, int argc, JSValueConst* argv) {
  JSValue val;
  int i, ret;

  val = JS_NewArray(ctx);
  if (JS_IsException(val))
    return val;
  for (i = first; i < argc; i++) {
    ret = JS_DefinePropertyValueUint32(
        ctx, val, i - first, JS_DupValue(ctx, argv[i]), JS_PROP_C_W_E);
    if (ret < 0) {
      JS_FreeValue(ctx, val);
      return JS_EXCEPTION;
    }
  }
  return val;
}

JSValue build_for_in_iterator(JSContext* ctx, JSValue obj) {
  JSObject *p, *p1;
  JSPropertyEnum* tab_atom;
  int i;
  JSValue enum_obj;
  JSForInIterator* it;
  uint32_t tag, tab_atom_count;

  tag = JS_VALUE_GET_TAG(obj);
  if (tag != JS_TAG_OBJECT && tag != JS_TAG_NULL && tag != JS_TAG_UNDEFINED) {
    obj = JS_ToObjectFree(ctx, obj);
  }

  it = js_malloc(ctx, sizeof(*it));
  if (!it) {
    JS_FreeValue(ctx, obj);
    return JS_EXCEPTION;
  }
  enum_obj = JS_NewObjectProtoClass(ctx, JS_NULL, JS_CLASS_FOR_IN_ITERATOR);
  if (JS_IsException(enum_obj)) {
    js_free(ctx, it);
    JS_FreeValue(ctx, obj);
    return JS_EXCEPTION;
  }
  it->is_array = FALSE;
  it->obj = obj;
  it->idx = 0;
  it->tab_atom = NULL;
  it->atom_count = 0;
  it->in_prototype_chain = FALSE;
  p1 = JS_VALUE_GET_OBJ(enum_obj);
  p1->u.for_in_iterator = it;

  if (tag == JS_TAG_NULL || tag == JS_TAG_UNDEFINED)
    return enum_obj;

  p = JS_VALUE_GET_OBJ(obj);

  if (p->fast_array) {
    JSShape* sh;
    JSShapeProperty* prs;
    /* check that there are no enumerable normal fields */
    sh = p->shape;
    for (i = 0, prs = get_shape_prop(sh); i < sh->prop_count; i++, prs++) {
      if (prs->flags & JS_PROP_ENUMERABLE)
        goto normal_case;
    }
    /* for fast arrays, we only store the number of elements */
    it->is_array = TRUE;
    it->atom_count = p->u.array.count;
  } else {
  normal_case:
    if (JS_GetOwnPropertyNamesInternal(
            ctx,
            &tab_atom,
            &tab_atom_count,
            p,
            JS_GPN_STRING_MASK | JS_GPN_SET_ENUM)) {
      JS_FreeValue(ctx, enum_obj);
      return JS_EXCEPTION;
    }
    it->tab_atom = tab_atom;
    it->atom_count = tab_atom_count;
  }
  return enum_obj;
}

/* return -1 if exception, 0 if slow case, 1 if the enumeration is finished */
static __exception int js_for_in_prepare_prototype_chain_enum(
    JSContext* ctx,
    JSValueConst enum_obj) {
  JSObject* p;
  JSForInIterator* it;
  JSPropertyEnum* tab_atom;
  uint32_t tab_atom_count, i;
  JSValue obj1;

  p = JS_VALUE_GET_OBJ(enum_obj);
  it = p->u.for_in_iterator;

  /* check if there are enumerable properties in the prototype chain (fast path)
   */
  obj1 = JS_DupValue(ctx, it->obj);
  for (;;) {
    obj1 = JS_GetPrototypeFree(ctx, obj1);
    if (JS_IsNull(obj1))
      break;
    if (JS_IsException(obj1))
      goto fail;
    if (JS_GetOwnPropertyNamesInternal(
            ctx,
            &tab_atom,
            &tab_atom_count,
            JS_VALUE_GET_OBJ(obj1),
            JS_GPN_STRING_MASK | JS_GPN_ENUM_ONLY)) {
      JS_FreeValue(ctx, obj1);
      goto fail;
    }
    JS_FreePropertyEnum(ctx, tab_atom, tab_atom_count);
    if (tab_atom_count != 0) {
      JS_FreeValue(ctx, obj1);
      goto slow_path;
    }
    /* must check for timeout to avoid infinite loop */
    if (js_poll_interrupts(ctx)) {
      JS_FreeValue(ctx, obj1);
      goto fail;
    }
  }
  JS_FreeValue(ctx, obj1);
  return 1;

slow_path:
  /* add the visited properties, even if they are not enumerable */
  if (it->is_array) {
    if (JS_GetOwnPropertyNamesInternal(
            ctx,
            &tab_atom,
            &tab_atom_count,
            JS_VALUE_GET_OBJ(it->obj),
            JS_GPN_STRING_MASK | JS_GPN_SET_ENUM)) {
      goto fail;
    }
    it->is_array = FALSE;
    it->tab_atom = tab_atom;
    it->atom_count = tab_atom_count;
  }

  for (i = 0; i < it->atom_count; i++) {
    if (JS_DefinePropertyValue(
            ctx, enum_obj, it->tab_atom[i].atom, JS_NULL, JS_PROP_ENUMERABLE) <
        0)
      goto fail;
  }
  return 0;
fail:
  return -1;
}

/* obj -> enum_obj */
__exception int js_for_in_start(JSContext* ctx, JSValue* sp) {
  sp[-1] = build_for_in_iterator(ctx, sp[-1]);
  if (JS_IsException(sp[-1]))
    return -1;
  return 0;
}

/* enum_obj -> enum_obj value done */
__exception int js_for_in_next(JSContext* ctx, JSValue* sp) {
  JSValueConst enum_obj;
  JSObject* p;
  JSAtom prop;
  JSForInIterator* it;
  JSPropertyEnum* tab_atom;
  uint32_t tab_atom_count;
  int ret;

  enum_obj = sp[-1];
  /* fail safe */
  if (JS_VALUE_GET_TAG(enum_obj) != JS_TAG_OBJECT)
    goto done;
  p = JS_VALUE_GET_OBJ(enum_obj);
  if (p->class_id != JS_CLASS_FOR_IN_ITERATOR)
    goto done;
  it = p->u.for_in_iterator;

  for (;;) {
    if (it->idx >= it->atom_count) {
      if (JS_IsNull(it->obj) || JS_IsUndefined(it->obj))
        goto done; /* not an object */
      /* no more property in the current object: look in the prototype */
      if (!it->in_prototype_chain) {
        ret = js_for_in_prepare_prototype_chain_enum(ctx, enum_obj);
        if (ret < 0)
          return -1;
        if (ret)
          goto done;
        it->in_prototype_chain = TRUE;
      }
      it->obj = JS_GetPrototypeFree(ctx, it->obj);
      if (JS_IsException(it->obj))
        return -1;
      if (JS_IsNull(it->obj))
        goto done; /* no more prototype */

      /* must check for timeout to avoid infinite loop */
      if (js_poll_interrupts(ctx))
        return -1;

      if (JS_GetOwnPropertyNamesInternal(
              ctx,
              &tab_atom,
              &tab_atom_count,
              JS_VALUE_GET_OBJ(it->obj),
              JS_GPN_STRING_MASK | JS_GPN_SET_ENUM)) {
        return -1;
      }
      JS_FreePropertyEnum(ctx, it->tab_atom, it->atom_count);
      it->tab_atom = tab_atom;
      it->atom_count = tab_atom_count;
      it->idx = 0;
    } else {
      if (it->is_array) {
        prop = __JS_AtomFromUInt32(it->idx);
        it->idx++;
      } else {
        BOOL is_enumerable;
        prop = it->tab_atom[it->idx].atom;
        is_enumerable = it->tab_atom[it->idx].is_enumerable;
        it->idx++;
        if (it->in_prototype_chain) {
          /* slow case: we are in the prototype chain */
          ret = JS_GetOwnPropertyInternal(
              ctx, NULL, JS_VALUE_GET_OBJ(enum_obj), prop);
          if (ret < 0)
            return ret;
          if (ret)
            continue; /* already visited */
          /* add to the visited property list */
          if (JS_DefinePropertyValue(
                  ctx, enum_obj, prop, JS_NULL, JS_PROP_ENUMERABLE) < 0)
            return -1;
        }
        if (!is_enumerable)
          continue;
      }
      /* check if the property was deleted */
      ret =
          JS_GetOwnPropertyInternal(ctx, NULL, JS_VALUE_GET_OBJ(it->obj), prop);
      if (ret < 0)
        return ret;
      if (ret)
        break;
    }
  }
  /* return the property */
  sp[0] = JS_AtomToValue(ctx, prop);
  sp[1] = JS_FALSE;
  return 0;
done:
  /* return the end */
  sp[0] = JS_UNDEFINED;
  sp[1] = JS_TRUE;
  return 0;
}

JSValue JS_GetIterator2(JSContext* ctx, JSValueConst obj, JSValueConst method) {
  JSValue enum_obj;

  enum_obj = JS_Call(ctx, method, obj, 0, NULL);
  if (JS_IsException(enum_obj))
    return enum_obj;
  if (!JS_IsObject(enum_obj)) {
    JS_FreeValue(ctx, enum_obj);
    return JS_ThrowTypeErrorNotAnObject(ctx);
  }
  return enum_obj;
}

JSValue JS_CreateAsyncFromSyncIterator(JSContext* ctx, JSValueConst sync_iter) {
  JSValue async_iter, next_method;
  JSAsyncFromSyncIteratorData* s;

  next_method = JS_GetProperty(ctx, sync_iter, JS_ATOM_next);
  if (JS_IsException(next_method))
    return JS_EXCEPTION;
  async_iter = JS_NewObjectClass(ctx, JS_CLASS_ASYNC_FROM_SYNC_ITERATOR);
  if (JS_IsException(async_iter)) {
    JS_FreeValue(ctx, next_method);
    return async_iter;
  }
  s = js_mallocz(ctx, sizeof(*s));
  if (!s) {
    JS_FreeValue(ctx, async_iter);
    JS_FreeValue(ctx, next_method);
    return JS_EXCEPTION;
  }
  s->sync_iter = JS_DupValue(ctx, sync_iter);
  s->next_method = next_method;
  JS_SetOpaque(async_iter, s);
  return async_iter;
}

JSValue JS_GetIterator(JSContext* ctx, JSValueConst obj, BOOL is_async) {
  JSValue method, ret, sync_iter;

  if (is_async) {
    method = JS_GetProperty(ctx, obj, JS_ATOM_Symbol_asyncIterator);
    if (JS_IsException(method))
      return method;
    if (JS_IsUndefined(method) || JS_IsNull(method)) {
      method = JS_GetProperty(ctx, obj, JS_ATOM_Symbol_iterator);
      if (JS_IsException(method))
        return method;
      sync_iter = JS_GetIterator2(ctx, obj, method);
      JS_FreeValue(ctx, method);
      if (JS_IsException(sync_iter))
        return sync_iter;
      ret = JS_CreateAsyncFromSyncIterator(ctx, sync_iter);
      JS_FreeValue(ctx, sync_iter);
      return ret;
    }
  } else {
    method = JS_GetProperty(ctx, obj, JS_ATOM_Symbol_iterator);
    if (JS_IsException(method))
      return method;
  }
  if (!JS_IsFunction(ctx, method)) {
    JS_FreeValue(ctx, method);
    return JS_ThrowTypeError(ctx, "value is not iterable");
  }
  ret = JS_GetIterator2(ctx, obj, method);
  JS_FreeValue(ctx, method);
  return ret;
}

/* return *pdone = 2 if the iterator object is not parsed */
JSValue JS_IteratorNext2(
    JSContext* ctx,
    JSValueConst enum_obj,
    JSValueConst method,
    int argc,
    JSValueConst* argv,
    int* pdone) {
  JSValue obj;

  /* fast path for the built-in iterators (avoid creating the
     intermediate result object) */
  if (JS_IsObject(method)) {
    JSObject* p = JS_VALUE_GET_OBJ(method);
    if (p->class_id == JS_CLASS_C_FUNCTION &&
        p->u.cfunc.cproto == JS_CFUNC_iterator_next) {
      JSCFunctionType func;
      JSValueConst args[1];

      /* in case the function expects one argument */
      if (argc == 0) {
        args[0] = JS_UNDEFINED;
        argv = args;
      }
      func = p->u.cfunc.c_function;
      return func.iterator_next(
          ctx, enum_obj, argc, argv, pdone, p->u.cfunc.magic);
    }
  }
  obj = JS_Call(ctx, method, enum_obj, argc, argv);
  if (JS_IsException(obj))
    goto fail;
  if (!JS_IsObject(obj)) {
    JS_FreeValue(ctx, obj);
    JS_ThrowTypeError(ctx, "iterator must return an object");
    goto fail;
  }
  *pdone = 2;
  return obj;
fail:
  *pdone = FALSE;
  return JS_EXCEPTION;
}

/* Note: always return JS_UNDEFINED when *pdone = TRUE. */
JSValue JS_IteratorNext(
    JSContext* ctx,
    JSValueConst enum_obj,
    JSValueConst method,
    int argc,
    JSValueConst* argv,
    BOOL* pdone) {
  JSValue obj, value, done_val;
  int done;

  obj = JS_IteratorNext2(ctx, enum_obj, method, argc, argv, &done);
  if (JS_IsException(obj))
    goto fail;
  if (likely(done == 0)) {
    *pdone = FALSE;
    return obj;
  } else if (done != 2) {
    JS_FreeValue(ctx, obj);
    *pdone = TRUE;
    return JS_UNDEFINED;
  } else {
    done_val = JS_GetProperty(ctx, obj, JS_ATOM_done);
    if (JS_IsException(done_val))
      goto fail;
    *pdone = JS_ToBoolFree(ctx, done_val);
    value = JS_UNDEFINED;
    if (!*pdone) {
      value = JS_GetProperty(ctx, obj, JS_ATOM_value);
    }
    JS_FreeValue(ctx, obj);
    return value;
  }
fail:
  JS_FreeValue(ctx, obj);
  *pdone = FALSE;
  return JS_EXCEPTION;
}

/* return < 0 in case of exception */
int JS_IteratorClose(
    JSContext* ctx,
    JSValueConst enum_obj,
    BOOL is_exception_pending) {
  JSValue method, ret, ex_obj;
  int res;

  if (is_exception_pending) {
    ex_obj = ctx->rt->current_exception;
    ctx->rt->current_exception = JS_NULL;
    res = -1;
  } else {
    ex_obj = JS_UNDEFINED;
    res = 0;
  }
  method = JS_GetProperty(ctx, enum_obj, JS_ATOM_return);
  if (JS_IsException(method)) {
    res = -1;
    goto done;
  }
  if (JS_IsUndefined(method) || JS_IsNull(method)) {
    goto done;
  }
  ret = JS_CallFree(ctx, method, enum_obj, 0, NULL);
  if (!is_exception_pending) {
    if (JS_IsException(ret)) {
      res = -1;
    } else if (!JS_IsObject(ret)) {
      JS_ThrowTypeErrorNotAnObject(ctx);
      res = -1;
    }
  }
  JS_FreeValue(ctx, ret);
done:
  if (is_exception_pending) {
    JS_Throw(ctx, ex_obj);
  }
  return res;
}

/* obj -> enum_rec (3 slots) */
__exception int js_for_of_start(JSContext* ctx, JSValue* sp, BOOL is_async) {
  JSValue op1, obj, method;
  op1 = sp[-1];
  obj = JS_GetIterator(ctx, op1, is_async);
  if (JS_IsException(obj))
    return -1;
  JS_FreeValue(ctx, op1);
  sp[-1] = obj;
  method = JS_GetProperty(ctx, obj, JS_ATOM_next);
  if (JS_IsException(method))
    return -1;
  sp[0] = method;
  return 0;
}

/* enum_rec [objs] -> enum_rec [objs] value done. There are 'offset'
   objs. If 'done' is true or in case of exception, 'enum_rec' is set
   to undefined. If 'done' is true, 'value' is always set to
   undefined. */
__exception int js_for_of_next(JSContext* ctx, JSValue* sp, int offset) {
  JSValue value = JS_UNDEFINED;
  int done = 1;

  if (likely(!JS_IsUndefined(sp[offset]))) {
    value = JS_IteratorNext(ctx, sp[offset], sp[offset + 1], 0, NULL, &done);
    if (JS_IsException(value))
      done = -1;
    if (done) {
      /* value is JS_UNDEFINED or JS_EXCEPTION */
      /* replace the iteration object with undefined */
      JS_FreeValue(ctx, sp[offset]);
      sp[offset] = JS_UNDEFINED;
      if (done < 0) {
        return -1;
      } else {
        JS_FreeValue(ctx, value);
        value = JS_UNDEFINED;
      }
    }
  }
  sp[0] = value;
  sp[1] = JS_NewBool(ctx, done);
  return 0;
}

__exception int js_for_await_of_next(JSContext* ctx, JSValue* sp) {
  JSValue obj, iter, next;

  sp[-1] = JS_UNDEFINED; /* disable the catch offset so that
                            exceptions do not close the iterator */
  iter = sp[-3];
  next = sp[-2];
  obj = JS_Call(ctx, next, iter, 0, NULL);
  if (JS_IsException(obj))
    return -1;
  sp[0] = obj;
  return 0;
}

JSValue
JS_IteratorGetCompleteValue(JSContext* ctx, JSValueConst obj, BOOL* pdone) {
  JSValue done_val, value;
  BOOL done;
  done_val = JS_GetProperty(ctx, obj, JS_ATOM_done);
  if (JS_IsException(done_val))
    goto fail;
  done = JS_ToBoolFree(ctx, done_val);
  value = JS_GetProperty(ctx, obj, JS_ATOM_value);
  if (JS_IsException(value))
    goto fail;
  *pdone = done;
  return value;
fail:
  *pdone = FALSE;
  return JS_EXCEPTION;
}

__exception int js_iterator_get_value_done(JSContext* ctx, JSValue* sp) {
  JSValue obj, value;
  BOOL done;
  obj = sp[-1];
  if (!JS_IsObject(obj)) {
    JS_ThrowTypeError(ctx, "iterator must return an object");
    return -1;
  }
  value = JS_IteratorGetCompleteValue(ctx, obj, &done);
  if (JS_IsException(value))
    return -1;
  JS_FreeValue(ctx, obj);
  /* put again the catch offset so that exceptions close the
     iterator */
  sp[-2] = JS_NewCatchOffset(ctx, 0);
  sp[-1] = value;
  sp[0] = JS_NewBool(ctx, done);
  return 0;
}
