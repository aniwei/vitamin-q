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

#include "js-map.h"
#include "../convertion.h"
#include "../exception.h"
#include "../object.h"
#include "../runtime.h"
#include "../string-utils.h"
#include "js-array.h"
#include "js-big-num.h"
#include "js-operator.h"
#include "js-weak-ref.h"

/* Set/Map/WeakSet/WeakMap */

#define MAGIC_SET (1 << 0)
#define MAGIC_WEAK (1 << 1)

JSValue js_map_constructor(
    JSContext* ctx,
    JSValueConst new_target,
    int argc,
    JSValueConst* argv,
    int magic) {
  JSMapState* s;
  JSValue obj, adder = JS_UNDEFINED, iter = JS_UNDEFINED,
               next_method = JS_UNDEFINED;
  JSValueConst arr;
  BOOL is_set, is_weak;

  is_set = magic & MAGIC_SET;
  is_weak = ((magic & MAGIC_WEAK) != 0);
  obj = js_create_from_ctor(ctx, new_target, JS_CLASS_MAP + magic);
  if (JS_IsException(obj))
    return JS_EXCEPTION;
  s = js_mallocz(ctx, sizeof(*s));
  if (!s)
    goto fail;
  init_list_head(&s->records);
  s->is_weak = is_weak;
  if (is_weak) {
    s->weakref_header.weakref_type = JS_WEAKREF_TYPE_MAP;
    list_add_tail(&s->weakref_header.link, &ctx->rt->weakref_list);
  }
  JS_SetOpaque(obj, s);
  s->hash_bits = 1;
  s->hash_size = 1U << s->hash_bits;
  s->hash_table = js_mallocz(ctx, sizeof(s->hash_table[0]) * s->hash_size);
  if (!s->hash_table)
    goto fail;
  s->record_count_threshold = 4;

  arr = JS_UNDEFINED;
  if (argc > 0)
    arr = argv[0];
  if (!JS_IsUndefined(arr) && !JS_IsNull(arr)) {
    JSValue item, ret;
    BOOL done;

    adder = JS_GetProperty(ctx, obj, is_set ? JS_ATOM_add : JS_ATOM_set);
    if (JS_IsException(adder))
      goto fail;
    if (!JS_IsFunction(ctx, adder)) {
      JS_ThrowTypeError(ctx, "set/add is not a function");
      goto fail;
    }

    iter = JS_GetIterator(ctx, arr, FALSE);
    if (JS_IsException(iter))
      goto fail;
    next_method = JS_GetProperty(ctx, iter, JS_ATOM_next);
    if (JS_IsException(next_method))
      goto fail;

    for (;;) {
      item = JS_IteratorNext(ctx, iter, next_method, 0, NULL, &done);
      if (JS_IsException(item))
        goto fail;
      if (done)
        break;
      if (is_set) {
        ret = JS_Call(ctx, adder, obj, 1, (JSValueConst*)&item);
        if (JS_IsException(ret)) {
          JS_FreeValue(ctx, item);
          goto fail_close;
        }
      } else {
        JSValue key, value;
        JSValueConst args[2];
        key = JS_UNDEFINED;
        value = JS_UNDEFINED;
        if (!JS_IsObject(item)) {
          JS_ThrowTypeErrorNotAnObject(ctx);
          goto fail1;
        }
        key = JS_GetPropertyUint32(ctx, item, 0);
        if (JS_IsException(key))
          goto fail1;
        value = JS_GetPropertyUint32(ctx, item, 1);
        if (JS_IsException(value))
          goto fail1;
        args[0] = key;
        args[1] = value;
        ret = JS_Call(ctx, adder, obj, 2, args);
        if (JS_IsException(ret)) {
        fail1:
          JS_FreeValue(ctx, item);
          JS_FreeValue(ctx, key);
          JS_FreeValue(ctx, value);
          goto fail_close;
        }
        JS_FreeValue(ctx, key);
        JS_FreeValue(ctx, value);
      }
      JS_FreeValue(ctx, ret);
      JS_FreeValue(ctx, item);
    }
    JS_FreeValue(ctx, next_method);
    JS_FreeValue(ctx, iter);
    JS_FreeValue(ctx, adder);
  }
  return obj;
fail_close:
  /* close the iterator object, preserving pending exception */
  JS_IteratorClose(ctx, iter, TRUE);
fail:
  JS_FreeValue(ctx, next_method);
  JS_FreeValue(ctx, iter);
  JS_FreeValue(ctx, adder);
  JS_FreeValue(ctx, obj);
  return JS_EXCEPTION;
}

/* XXX: could normalize strings to speed up comparison */
JSValueConst map_normalize_key(JSContext* ctx, JSValueConst key) {
  uint32_t tag = JS_VALUE_GET_TAG(key);
  /* convert -0.0 to +0.0 */
  if (JS_TAG_IS_FLOAT64(tag) && JS_VALUE_GET_FLOAT64(key) == 0.0) {
    key = JS_NewInt32(ctx, 0);
  }
  return key;
}

/* hash multipliers, same as the Linux kernel (see Knuth vol 3,
   section 6.4, exercise 9) */
#define HASH_MUL32 0x61C88647
#define HASH_MUL64 UINT64_C(0x61C8864680B583EB)

static uint32_t map_hash32(uint32_t a, int hash_bits) {
  return (a * HASH_MUL32) >> (32 - hash_bits);
}

static uint32_t map_hash64(uint64_t a, int hash_bits) {
  return (a * HASH_MUL64) >> (64 - hash_bits);
}

static uint32_t map_hash_pointer(uintptr_t a, int hash_bits) {
#ifdef JS_PTR64
  return map_hash64(a, hash_bits);
#else
  return map_hash32(a, hash_bits);
#endif
}

/* XXX: better hash ? */
/* precondition: 1 <= hash_bits <= 32 */
static uint32_t map_hash_key(JSValueConst key, int hash_bits) {
  uint32_t tag = JS_VALUE_GET_NORM_TAG(key);
  uint32_t h;
  double d;
  JSBigInt* p;
  JSBigIntBuf buf;

  switch (tag) {
    case JS_TAG_BOOL:
      h = map_hash32(JS_VALUE_GET_INT(key) ^ JS_TAG_BOOL, hash_bits);
      break;
    case JS_TAG_STRING:
      h = map_hash32(
          hash_string(JS_VALUE_GET_STRING(key), 0) ^ JS_TAG_STRING, hash_bits);
      break;
    case JS_TAG_STRING_ROPE:
      h = map_hash32(hash_string_rope(key, 0) ^ JS_TAG_STRING, hash_bits);
      break;
    case JS_TAG_OBJECT:
    case JS_TAG_SYMBOL:
      h = map_hash_pointer((uintptr_t)JS_VALUE_GET_PTR(key) ^ tag, hash_bits);
      break;
    case JS_TAG_INT:
      d = JS_VALUE_GET_INT(key);
      goto hash_float64;
    case JS_TAG_FLOAT64:
      d = JS_VALUE_GET_FLOAT64(key);
      /* normalize the NaN */
      if (isnan(d))
        d = JS_FLOAT64_NAN;
    hash_float64:
      h = map_hash64(float64_as_uint64(d) ^ JS_TAG_FLOAT64, hash_bits);
      break;
    case JS_TAG_SHORT_BIG_INT:
      p = js_bigint_set_short(&buf, key);
      goto hash_bigint;
    case JS_TAG_BIG_INT:
      p = JS_VALUE_GET_PTR(key);
    hash_bigint: {
      int i;
      h = 1;
      for (i = p->len - 1; i >= 0; i--) {
        h = h * 263 + p->tab[i];
      }
      /* the final step is necessary otherwise h mod n only
         depends of p->tab[i] mod n */
      h = map_hash32(h ^ JS_TAG_BIG_INT, hash_bits);
    } break;
    default:
      h = 0;
      break;
  }
  return h;
}

JSMapRecord* map_find_record(JSContext* ctx, JSMapState* s, JSValueConst key) {
  JSMapRecord* mr;
  uint32_t h;
  h = map_hash_key(key, s->hash_bits);
  for (mr = s->hash_table[h]; mr != NULL; mr = mr->hash_next) {
    if (mr->empty || (s->is_weak && !js_weakref_is_live(mr->key))) {
      /* cannot match */
    } else {
      if (js_same_value_zero(ctx, mr->key, key))
        return mr;
    }
  }
  return NULL;
}

void map_hash_resize(JSContext* ctx, JSMapState* s) {
  uint32_t new_hash_size, h;
  int new_hash_bits;
  struct list_head* el;
  JSMapRecord *mr, **new_hash_table;

  /* XXX: no reporting of memory allocation failure */
  new_hash_bits = min_int(s->hash_bits + 1, 31);
  new_hash_size = 1U << new_hash_bits;
  new_hash_table =
      js_realloc(ctx, s->hash_table, sizeof(new_hash_table[0]) * new_hash_size);
  if (!new_hash_table)
    return;

  memset(new_hash_table, 0, sizeof(new_hash_table[0]) * new_hash_size);

  list_for_each(el, &s->records) {
    mr = list_entry(el, JSMapRecord, link);
    if (mr->empty || (s->is_weak && !js_weakref_is_live(mr->key))) {
    } else {
      h = map_hash_key(mr->key, new_hash_bits);
      mr->hash_next = new_hash_table[h];
      new_hash_table[h] = mr;
    }
  }
  s->hash_table = new_hash_table;
  s->hash_bits = new_hash_bits;
  s->hash_size = new_hash_size;
  s->record_count_threshold = new_hash_size * 2;
}

JSMapRecord* map_add_record(JSContext* ctx, JSMapState* s, JSValueConst key) {
  uint32_t h;
  JSMapRecord* mr;

  mr = js_malloc(ctx, sizeof(*mr));
  if (!mr)
    return NULL;
  mr->ref_count = 1;
  mr->empty = FALSE;
  if (s->is_weak) {
    mr->key = js_weakref_new(ctx, key);
  } else {
    mr->key = JS_DupValue(ctx, key);
  }
  h = map_hash_key(key, s->hash_bits);
  mr->hash_next = s->hash_table[h];
  s->hash_table[h] = mr;
  list_add_tail(&mr->link, &s->records);
  s->record_count++;
  if (s->record_count >= s->record_count_threshold) {
    map_hash_resize(ctx, s);
  }
  return mr;
}

/* warning: the record must be removed from the hash table before */
void map_delete_record(JSRuntime* rt, JSMapState* s, JSMapRecord* mr) {
  if (mr->empty)
    return;

  if (s->is_weak) {
    js_weakref_free(rt, mr->key);
  } else {
    JS_FreeValueRT(rt, mr->key);
  }
  JS_FreeValueRT(rt, mr->value);
  if (--mr->ref_count == 0) {
    list_del(&mr->link);
    js_free_rt(rt, mr);
  } else {
    /* keep a zombie record for iterators */
    mr->empty = TRUE;
    mr->key = JS_UNDEFINED;
    mr->value = JS_UNDEFINED;
  }
  s->record_count--;
}

void map_decref_record(JSRuntime* rt, JSMapRecord* mr) {
  if (--mr->ref_count == 0) {
    /* the record can be safely removed */
    JS_ASSERT(mr->empty);
    list_del(&mr->link);
    js_free_rt(rt, mr);
  }
}

void map_delete_weakrefs(JSRuntime* rt, JSWeakRefHeader* wh) {
  JSMapState* s = container_of(wh, JSMapState, weakref_header);
  struct list_head *el, *el1;
  JSMapRecord *mr1, **pmr;
  uint32_t h;

  list_for_each_safe(el, el1, &s->records) {
    JSMapRecord* mr = list_entry(el, JSMapRecord, link);
    if (!js_weakref_is_live(mr->key)) {
      /* even if key is not live it can be hashed as a pointer */
      h = map_hash_key(mr->key, s->hash_bits);
      pmr = &s->hash_table[h];
      for (;;) {
        mr1 = *pmr;
        /* the entry may already be removed from the hash
           table if the map was resized */
        if (mr1 == NULL)
          goto done;
        if (mr1 == mr)
          break;
        pmr = &mr1->hash_next;
      }
      /* remove from the hash table */
      *pmr = mr1->hash_next;
    done:
      map_delete_record(rt, s, mr);
    }
  }
}

JSValue js_map_set(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv,
    int magic) {
  JSMapState* s = JS_GetOpaque2(ctx, this_val, JS_CLASS_MAP + magic);
  JSMapRecord* mr;
  JSValueConst key, value;

  if (!s)
    return JS_EXCEPTION;
  key = map_normalize_key(ctx, argv[0]);
  if (s->is_weak && !js_weakref_is_target(key))
    return JS_ThrowTypeError(
        ctx,
        "invalid value used as %s key",
        (magic & MAGIC_SET) ? "WeakSet" : "WeakMap");
  if (magic & MAGIC_SET)
    value = JS_UNDEFINED;
  else
    value = argv[1];
  mr = map_find_record(ctx, s, key);
  if (mr) {
    JS_FreeValue(ctx, mr->value);
  } else {
    mr = map_add_record(ctx, s, key);
    if (!mr)
      return JS_EXCEPTION;
  }
  mr->value = JS_DupValue(ctx, value);
  return JS_DupValue(ctx, this_val);
}

JSValue js_map_get(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv,
    int magic) {
  JSMapState* s = JS_GetOpaque2(ctx, this_val, JS_CLASS_MAP + magic);
  JSMapRecord* mr;
  JSValueConst key;

  if (!s)
    return JS_EXCEPTION;
  key = map_normalize_key(ctx, argv[0]);
  mr = map_find_record(ctx, s, key);
  if (!mr)
    return JS_UNDEFINED;
  else
    return JS_DupValue(ctx, mr->value);
}

JSValue js_map_has(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv,
    int magic) {
  JSMapState* s = JS_GetOpaque2(ctx, this_val, JS_CLASS_MAP + magic);
  JSMapRecord* mr;
  JSValueConst key;

  if (!s)
    return JS_EXCEPTION;
  key = map_normalize_key(ctx, argv[0]);
  mr = map_find_record(ctx, s, key);
  return JS_NewBool(ctx, mr != NULL);
}

JSValue js_map_delete(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv,
    int magic) {
  JSMapState* s = JS_GetOpaque2(ctx, this_val, JS_CLASS_MAP + magic);
  JSMapRecord *mr, **pmr;
  JSValueConst key;
  uint32_t h;

  if (!s)
    return JS_EXCEPTION;
  key = map_normalize_key(ctx, argv[0]);

  h = map_hash_key(key, s->hash_bits);
  pmr = &s->hash_table[h];
  for (;;) {
    mr = *pmr;
    if (mr == NULL)
      return JS_FALSE;
    if (mr->empty || (s->is_weak && !js_weakref_is_live(mr->key))) {
      /* not valid */
    } else {
      if (js_same_value_zero(ctx, mr->key, key))
        break;
    }
    pmr = &mr->hash_next;
  }

  /* remove from the hash table */
  *pmr = mr->hash_next;

  map_delete_record(ctx->rt, s, mr);
  return JS_TRUE;
}

JSValue js_map_clear(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv,
    int magic) {
  JSMapState* s = JS_GetOpaque2(ctx, this_val, JS_CLASS_MAP + magic);
  struct list_head *el, *el1;
  JSMapRecord* mr;

  if (!s)
    return JS_EXCEPTION;

  /* remove from the hash table */
  memset(s->hash_table, 0, sizeof(s->hash_table[0]) * s->hash_size);

  list_for_each_safe(el, el1, &s->records) {
    mr = list_entry(el, JSMapRecord, link);
    map_delete_record(ctx->rt, s, mr);
  }
  return JS_UNDEFINED;
}

JSValue js_map_get_size(JSContext* ctx, JSValueConst this_val, int magic) {
  JSMapState* s = JS_GetOpaque2(ctx, this_val, JS_CLASS_MAP + magic);
  if (!s)
    return JS_EXCEPTION;
  return JS_NewUint32(ctx, s->record_count);
}

JSValue js_map_forEach(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv,
    int magic) {
  JSMapState* s = JS_GetOpaque2(ctx, this_val, JS_CLASS_MAP + magic);
  JSValueConst func, this_arg;
  JSValue ret, args[3];
  struct list_head* el;
  JSMapRecord* mr;

  if (!s)
    return JS_EXCEPTION;
  func = argv[0];
  if (argc > 1)
    this_arg = argv[1];
  else
    this_arg = JS_UNDEFINED;
  if (check_function(ctx, func))
    return JS_EXCEPTION;
  /* Note: the list can be modified while traversing it, but the
     current element is locked */
  el = s->records.next;
  while (el != &s->records) {
    mr = list_entry(el, JSMapRecord, link);
    if (!mr->empty) {
      mr->ref_count++;
      /* must duplicate in case the record is deleted */
      args[1] = JS_DupValue(ctx, mr->key);
      if (magic)
        args[0] = args[1];
      else
        args[0] = JS_DupValue(ctx, mr->value);
      args[2] = (JSValue)this_val;
      ret = JS_Call(ctx, func, this_arg, 3, (JSValueConst*)args);
      JS_FreeValue(ctx, args[0]);
      if (!magic)
        JS_FreeValue(ctx, args[1]);
      el = el->next;
      map_decref_record(ctx->rt, mr);
      if (JS_IsException(ret))
        return ret;
      JS_FreeValue(ctx, ret);
    } else {
      el = el->next;
    }
  }
  return JS_UNDEFINED;
}

JSValue js_object_groupBy(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv,
    int is_map) {
  JSValueConst cb, args[2];
  JSValue res, iter, next, groups, key, v, prop;
  JSAtom key_atom = JS_ATOM_NULL;
  int64_t idx;
  BOOL done;

  // "is function?" check must be observed before argv[0] is accessed
  cb = argv[1];
  if (check_function(ctx, cb))
    return JS_EXCEPTION;

  iter = JS_GetIterator(ctx, argv[0], /*is_async*/ FALSE);
  if (JS_IsException(iter))
    return JS_EXCEPTION;

  key = JS_UNDEFINED;
  key_atom = JS_ATOM_NULL;
  v = JS_UNDEFINED;
  prop = JS_UNDEFINED;
  groups = JS_UNDEFINED;

  next = JS_GetProperty(ctx, iter, JS_ATOM_next);
  if (JS_IsException(next))
    goto exception;

  if (is_map) {
    groups = js_map_constructor(ctx, JS_UNDEFINED, 0, NULL, 0);
  } else {
    groups = JS_NewObjectProto(ctx, JS_NULL);
  }
  if (JS_IsException(groups))
    goto exception;

  for (idx = 0;; idx++) {
    if (idx >= MAX_SAFE_INTEGER) {
      JS_ThrowTypeError(ctx, "too many elements");
      goto iterator_close_exception;
    }
    v = JS_IteratorNext(ctx, iter, next, 0, NULL, &done);
    if (JS_IsException(v))
      goto exception;
    if (done)
      break; // v is JS_UNDEFINED

    args[0] = v;
    args[1] = JS_NewInt64(ctx, idx);
    key = JS_Call(ctx, cb, ctx->global_obj, 2, args);
    if (JS_IsException(key))
      goto iterator_close_exception;

    if (is_map) {
      prop = js_map_get(ctx, groups, 1, (JSValueConst*)&key, 0);
    } else {
      key_atom = JS_ValueToAtom(ctx, key);
      JS_FreeValue(ctx, key);
      key = JS_UNDEFINED;
      if (key_atom == JS_ATOM_NULL)
        goto iterator_close_exception;
      prop = JS_GetProperty(ctx, groups, key_atom);
    }
    if (JS_IsException(prop))
      goto exception;

    if (JS_IsUndefined(prop)) {
      prop = JS_NewArray(ctx);
      if (JS_IsException(prop))
        goto exception;
      if (is_map) {
        args[0] = key;
        args[1] = prop;
        res = js_map_set(ctx, groups, 2, args, 0);
        if (JS_IsException(res))
          goto exception;
        JS_FreeValue(ctx, res);
      } else {
        prop = JS_DupValue(ctx, prop);
        if (JS_DefinePropertyValue(ctx, groups, key_atom, prop, JS_PROP_C_W_E) <
            0) {
          goto exception;
        }
      }
    }
    res = js_array_push(ctx, prop, 1, (JSValueConst*)&v, /*unshift*/ 0);
    if (JS_IsException(res))
      goto exception;
    // res is an int64

    JS_FreeValue(ctx, prop);
    JS_FreeValue(ctx, key);
    JS_FreeAtom(ctx, key_atom);
    JS_FreeValue(ctx, v);
    prop = JS_UNDEFINED;
    key = JS_UNDEFINED;
    key_atom = JS_ATOM_NULL;
    v = JS_UNDEFINED;
  }

  JS_FreeValue(ctx, iter);
  JS_FreeValue(ctx, next);
  return groups;

iterator_close_exception:
  JS_IteratorClose(ctx, iter, TRUE);
exception:
  JS_FreeAtom(ctx, key_atom);
  JS_FreeValue(ctx, prop);
  JS_FreeValue(ctx, key);
  JS_FreeValue(ctx, v);
  JS_FreeValue(ctx, groups);
  JS_FreeValue(ctx, iter);
  JS_FreeValue(ctx, next);
  return JS_EXCEPTION;
}

void js_map_finalizer(JSRuntime* rt, JSValue val) {
  JSObject* p;
  JSMapState* s;
  struct list_head *el, *el1;
  JSMapRecord* mr;

  p = JS_VALUE_GET_OBJ(val);
  s = p->u.map_state;
  if (s) {
    /* if the object is deleted we are sure that no iterator is
       using it */
    list_for_each_safe(el, el1, &s->records) {
      mr = list_entry(el, JSMapRecord, link);
      if (!mr->empty) {
        if (s->is_weak)
          js_weakref_free(rt, mr->key);
        else
          JS_FreeValueRT(rt, mr->key);
        JS_FreeValueRT(rt, mr->value);
      }
      js_free_rt(rt, mr);
    }
    js_free_rt(rt, s->hash_table);
    if (s->is_weak) {
      list_del(&s->weakref_header.link);
    }
    js_free_rt(rt, s);
  }
}

void js_map_mark(JSRuntime* rt, JSValueConst val, JS_MarkFunc* mark_func) {
  JSObject* p = JS_VALUE_GET_OBJ(val);
  JSMapState* s;
  struct list_head* el;
  JSMapRecord* mr;

  s = p->u.map_state;
  if (s) {
    list_for_each(el, &s->records) {
      mr = list_entry(el, JSMapRecord, link);
      if (!s->is_weak)
        JS_MarkValue(rt, mr->key, mark_func);
      JS_MarkValue(rt, mr->value, mark_func);
    }
  }
}

/* Map Iterator */

typedef struct JSMapIteratorData {
  JSValue obj;
  JSIteratorKindEnum kind;
  JSMapRecord* cur_record;
} JSMapIteratorData;

void js_map_iterator_finalizer(JSRuntime* rt, JSValue val) {
  JSObject* p;
  JSMapIteratorData* it;

  p = JS_VALUE_GET_OBJ(val);
  it = p->u.map_iterator_data;
  if (it) {
    /* During the GC sweep phase the Map finalizer may be
       called before the Map iterator finalizer */
    if (JS_IsLiveObject(rt, it->obj) && it->cur_record) {
      map_decref_record(rt, it->cur_record);
    }
    JS_FreeValueRT(rt, it->obj);
    js_free_rt(rt, it);
  }
}

void js_map_iterator_mark(
    JSRuntime* rt,
    JSValueConst val,
    JS_MarkFunc* mark_func) {
  JSObject* p = JS_VALUE_GET_OBJ(val);
  JSMapIteratorData* it;
  it = p->u.map_iterator_data;
  if (it) {
    /* the record is already marked by the object */
    JS_MarkValue(rt, it->obj, mark_func);
  }
}

JSValue js_create_map_iterator(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv,
    int magic) {
  JSIteratorKindEnum kind;
  JSMapState* s;
  JSMapIteratorData* it;
  JSValue enum_obj;

  kind = magic >> 2;
  magic &= 3;
  s = JS_GetOpaque2(ctx, this_val, JS_CLASS_MAP + magic);
  if (!s)
    return JS_EXCEPTION;
  enum_obj = JS_NewObjectClass(ctx, JS_CLASS_MAP_ITERATOR + magic);
  if (JS_IsException(enum_obj))
    goto fail;
  it = js_malloc(ctx, sizeof(*it));
  if (!it) {
    JS_FreeValue(ctx, enum_obj);
    goto fail;
  }
  it->obj = JS_DupValue(ctx, this_val);
  it->kind = kind;
  it->cur_record = NULL;
  JS_SetOpaque(enum_obj, it);
  return enum_obj;
fail:
  return JS_EXCEPTION;
}

JSValue js_map_iterator_next(
    JSContext* ctx,
    JSValueConst this_val,
    int argc,
    JSValueConst* argv,
    BOOL* pdone,
    int magic) {
  JSMapIteratorData* it;
  JSMapState* s;
  JSMapRecord* mr;
  struct list_head* el;

  it = JS_GetOpaque2(ctx, this_val, JS_CLASS_MAP_ITERATOR + magic);
  if (!it) {
    *pdone = FALSE;
    return JS_EXCEPTION;
  }
  if (JS_IsUndefined(it->obj))
    goto done;
  s = JS_GetOpaque(it->obj, JS_CLASS_MAP + magic);
  JS_ASSERT_CONTEXT(ctx, s != NULL);
  if (!it->cur_record) {
    el = s->records.next;
  } else {
    mr = it->cur_record;
    el = mr->link.next;
    map_decref_record(ctx->rt, mr); /* the record can be freed here */
  }
  for (;;) {
    if (el == &s->records) {
      /* no more record  */
      it->cur_record = NULL;
      JS_FreeValue(ctx, it->obj);
      it->obj = JS_UNDEFINED;
    done:
      /* end of enumeration */
      *pdone = TRUE;
      return JS_UNDEFINED;
    }
    mr = list_entry(el, JSMapRecord, link);
    if (!mr->empty)
      break;
    /* get the next record */
    el = mr->link.next;
  }

  /* lock the record so that it won't be freed */
  mr->ref_count++;
  it->cur_record = mr;
  *pdone = FALSE;

  if (it->kind == JS_ITERATOR_KIND_KEY) {
    return JS_DupValue(ctx, mr->key);
  } else {
    JSValueConst args[2];
    args[0] = mr->key;
    if (magic)
      args[1] = mr->key;
    else
      args[1] = mr->value;
    if (it->kind == JS_ITERATOR_KIND_VALUE) {
      return JS_DupValue(ctx, args[1]);
    } else {
      return js_create_array(ctx, 2, args);
    }
  }
}

const JSCFunctionListEntry js_map_funcs[] = {
    JS_CFUNC_MAGIC_DEF("groupBy", 2, js_object_groupBy, 1),
    JS_CGETSET_DEF("[Symbol.species]", js_get_this, NULL),
};

const JSCFunctionListEntry js_map_proto_funcs[] = {
    JS_CFUNC_MAGIC_DEF("set", 2, js_map_set, 0),
    JS_CFUNC_MAGIC_DEF("get", 1, js_map_get, 0),
    JS_CFUNC_MAGIC_DEF("has", 1, js_map_has, 0),
    JS_CFUNC_MAGIC_DEF("delete", 1, js_map_delete, 0),
    JS_CFUNC_MAGIC_DEF("clear", 0, js_map_clear, 0),
    JS_CGETSET_MAGIC_DEF("size", js_map_get_size, NULL, 0),
    JS_CFUNC_MAGIC_DEF("forEach", 1, js_map_forEach, 0),
    JS_CFUNC_MAGIC_DEF(
        "values",
        0,
        js_create_map_iterator,
        (JS_ITERATOR_KIND_VALUE << 2) | 0),
    JS_CFUNC_MAGIC_DEF(
        "keys",
        0,
        js_create_map_iterator,
        (JS_ITERATOR_KIND_KEY << 2) | 0),
    JS_CFUNC_MAGIC_DEF(
        "entries",
        0,
        js_create_map_iterator,
        (JS_ITERATOR_KIND_KEY_AND_VALUE << 2) | 0),
    JS_ALIAS_DEF("[Symbol.iterator]", "entries"),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "Map", JS_PROP_CONFIGURABLE),
};

const JSCFunctionListEntry js_map_iterator_proto_funcs[] = {
    JS_ITERATOR_NEXT_DEF("next", 0, js_map_iterator_next, 0),
    JS_PROP_STRING_DEF(
        "[Symbol.toStringTag]",
        "Map Iterator",
        JS_PROP_CONFIGURABLE),
};

const JSCFunctionListEntry js_set_proto_funcs[] = {
    JS_CFUNC_MAGIC_DEF("add", 1, js_map_set, MAGIC_SET),
    JS_CFUNC_MAGIC_DEF("has", 1, js_map_has, MAGIC_SET),
    JS_CFUNC_MAGIC_DEF("delete", 1, js_map_delete, MAGIC_SET),
    JS_CFUNC_MAGIC_DEF("clear", 0, js_map_clear, MAGIC_SET),
    JS_CGETSET_MAGIC_DEF("size", js_map_get_size, NULL, MAGIC_SET),
    JS_CFUNC_MAGIC_DEF("forEach", 1, js_map_forEach, MAGIC_SET),
    JS_CFUNC_MAGIC_DEF(
        "values",
        0,
        js_create_map_iterator,
        (JS_ITERATOR_KIND_KEY << 2) | MAGIC_SET),
    JS_ALIAS_DEF("keys", "values"),
    JS_ALIAS_DEF("[Symbol.iterator]", "values"),
    JS_CFUNC_MAGIC_DEF(
        "entries",
        0,
        js_create_map_iterator,
        (JS_ITERATOR_KIND_KEY_AND_VALUE << 2) | MAGIC_SET),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "Set", JS_PROP_CONFIGURABLE),
};

const JSCFunctionListEntry js_set_iterator_proto_funcs[] = {
    JS_ITERATOR_NEXT_DEF("next", 0, js_map_iterator_next, MAGIC_SET),
    JS_PROP_STRING_DEF(
        "[Symbol.toStringTag]",
        "Set Iterator",
        JS_PROP_CONFIGURABLE),
};

const JSCFunctionListEntry js_weak_map_proto_funcs[] = {
    JS_CFUNC_MAGIC_DEF("set", 2, js_map_set, MAGIC_WEAK),
    JS_CFUNC_MAGIC_DEF("get", 1, js_map_get, MAGIC_WEAK),
    JS_CFUNC_MAGIC_DEF("has", 1, js_map_has, MAGIC_WEAK),
    JS_CFUNC_MAGIC_DEF("delete", 1, js_map_delete, MAGIC_WEAK),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "WeakMap", JS_PROP_CONFIGURABLE),
};

const JSCFunctionListEntry js_weak_set_proto_funcs[] = {
    JS_CFUNC_MAGIC_DEF("add", 1, js_map_set, MAGIC_SET | MAGIC_WEAK),
    JS_CFUNC_MAGIC_DEF("has", 1, js_map_has, MAGIC_SET | MAGIC_WEAK),
    JS_CFUNC_MAGIC_DEF("delete", 1, js_map_delete, MAGIC_SET | MAGIC_WEAK),
    JS_PROP_STRING_DEF("[Symbol.toStringTag]", "WeakSet", JS_PROP_CONFIGURABLE),
};

const JSCFunctionListEntry* const js_map_proto_funcs_ptr[6] = {
    js_map_proto_funcs,
    js_set_proto_funcs,
    js_weak_map_proto_funcs,
    js_weak_set_proto_funcs,
    js_map_iterator_proto_funcs,
    js_set_iterator_proto_funcs,
};

const uint8_t js_map_proto_funcs_count[6] = {
    countof(js_map_proto_funcs),
    countof(js_set_proto_funcs),
    countof(js_weak_map_proto_funcs),
    countof(js_weak_set_proto_funcs),
    countof(js_map_iterator_proto_funcs),
    countof(js_set_iterator_proto_funcs),
};

void JS_AddIntrinsicMapSet(JSContext* ctx) {
  int i;
  JSValue obj1;
  char buf[ATOM_GET_STR_BUF_SIZE];

  for (i = 0; i < 4; i++) {
    const char* name = JS_AtomGetStr(ctx, buf, sizeof(buf), JS_ATOM_Map + i);
    ctx->class_proto[JS_CLASS_MAP + i] = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(
        ctx,
        ctx->class_proto[JS_CLASS_MAP + i],
        js_map_proto_funcs_ptr[i],
        js_map_proto_funcs_count[i]);
    obj1 = JS_NewCFunctionMagic(
        ctx, js_map_constructor, name, 0, JS_CFUNC_constructor_magic, i);
    if (i < 2) {
      JS_SetPropertyFunctionList(
          ctx, obj1, js_map_funcs, countof(js_map_funcs));
    }
    JS_NewGlobalCConstructor2(
        ctx, obj1, name, ctx->class_proto[JS_CLASS_MAP + i]);
  }

  for (i = 0; i < 2; i++) {
    ctx->class_proto[JS_CLASS_MAP_ITERATOR + i] =
        JS_NewObjectProto(ctx, ctx->iterator_proto);
    JS_SetPropertyFunctionList(
        ctx,
        ctx->class_proto[JS_CLASS_MAP_ITERATOR + i],
        js_map_proto_funcs_ptr[i + 4],
        js_map_proto_funcs_count[i + 4]);
  }
}
