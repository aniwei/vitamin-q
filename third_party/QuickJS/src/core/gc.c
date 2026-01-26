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

#include "gc.h"
#include "builtins/js-async-function.h"
#include "builtins/js-map.h"
#include "builtins/js-proxy.h"
#include "builtins/js-weak-ref.h"
#include "bytecode.h"
#include "exception.h"
#include "malloc.h"
#include "module.h"
#include "object.h"
#include "parser.h"
#include "runtime.h"
#include "shape.h"

__maybe_unused void
JS_DumpValue(JSContext* ctx, const char* str, JSValueConst val) {
  printf("%s=", str);
  JS_PrintValue(ctx, js_dump_value_write, stdout, val, NULL);
  printf("\n");
}

__maybe_unused void
JS_DumpValueRT(JSRuntime* rt, const char* str, JSValueConst val) {
  printf("%s=", str);
  JS_PrintValueRT(rt, js_dump_value_write, stdout, val, NULL);
  printf("\n");
}

#ifdef ANDROID_PRINT
#include <android/log.h>
#define printf(...) __android_log_print(ANDROID_LOG_INFO, "QuickJS", __VA_ARGS__)
#endif

__maybe_unused void JS_DumpObjectHeader(JSRuntime* rt) {
  printf(
      "%14s %4s %4s %14s %s\n", "ADDRESS", "REFS", "SHRF", "PROTO", "CONTENT");
}

/* for debug only: dump an object without side effect */
__maybe_unused void JS_DumpObject(JSRuntime* rt, JSObject* p) {
  JSShape* sh;
  JSPrintValueOptions options;

  /* XXX: should encode atoms with special characters */
  sh = p->shape; /* the shape can be NULL while freeing an object */
  printf("%14p %4d ", (void*)p, p->header.ref_count);
  if (sh) {
    printf(
        "%3d%c %14p ",
        sh->header.ref_count,
        " *"[sh->is_hashed],
        (void*)sh -> proto);
  } else {
    printf("%3s  %14s ", "-", "-");
  }

  JS_PrintValueSetDefaultOptions(&options);
  options.max_depth = 1;
  options.show_hidden = TRUE;
  options.raw_dump = TRUE;
  JS_PrintValueRT(
      rt, js_dump_value_write, stdout, JS_MKPTR(JS_TAG_OBJECT, p), &options);

  printf("\n");
}

__maybe_unused void JS_DumpGCObject(JSRuntime* rt, JSGCObjectHeader* p) {
  if (p->gc_obj_type == JS_GC_OBJ_TYPE_JS_OBJECT) {
    JS_DumpObject(rt, (JSObject*)p);
  } else {
    printf("%14p %4d ", (void*)p, p->ref_count);
    switch (p->gc_obj_type) {
      case JS_GC_OBJ_TYPE_FUNCTION_BYTECODE:
        printf("[function bytecode]");
        break;
      case JS_GC_OBJ_TYPE_SHAPE:
        printf("[shape]");
        break;
      case JS_GC_OBJ_TYPE_VAR_REF:
        printf("[var_ref]");
        break;
      case JS_GC_OBJ_TYPE_ASYNC_FUNCTION:
        printf("[async_function]");
        break;
      case JS_GC_OBJ_TYPE_JS_CONTEXT:
        printf("[js_context]");
        break;
      case JS_GC_OBJ_TYPE_MODULE:
        printf("[module]");
        break;
      default:
        printf("[unknown %d]", p->gc_obj_type);
        break;
    }
    printf("\n");
  }
}

/* `js_resolve_proxy`: resolve the proxy chain
   `*pval` is updated with to ultimate proxy target
   `throw_exception` controls whether exceptions are thown or not
   - return -1 in case of error
   - otherwise return 0
 */
int js_resolve_proxy(JSContext* ctx, JSValueConst* pval, BOOL throw_exception) {
  int depth = 0;
  JSObject* p;
  JSProxyData* s;

  while (JS_VALUE_GET_TAG(*pval) == JS_TAG_OBJECT) {
    p = JS_VALUE_GET_OBJ(*pval);
    if (p->class_id != JS_CLASS_PROXY)
      break;
    if (depth++ > 1000) {
      if (throw_exception)
        JS_ThrowStackOverflow(ctx);
      return -1;
    }
    s = p->u.opaque;
    if (s->is_revoked) {
      if (throw_exception)
        JS_ThrowTypeErrorRevokedProxy(ctx);
      return -1;
    }
    *pval = s->target;
  }
  return 0;
}

void js_dump_value_write(void* opaque, const char* buf, size_t len) {
  FILE* fo = opaque;
  fwrite(buf, 1, len, fo);
}

void js_dump_char(JSPrintValueState* s, int c, int sep) {
  if (c == sep || c == '\\') {
    js_putc(s, '\\');
    js_putc(s, c);
  } else if (c >= ' ' && c <= 126) {
    js_putc(s, c);
  } else if (c == '\n') {
    js_putc(s, '\\');
    js_putc(s, 'n');
  } else {
    js_printf(s, "\\u%04x", c);
  }
}

void js_object_list_init(JSObjectList* s) {
  memset(s, 0, sizeof(*s));
}

uint32_t js_object_list_get_hash(JSObject* p, uint32_t hash_size) {
  return ((uintptr_t)p * 3163) & (hash_size - 1);
}

int js_object_list_resize_hash(
    JSContext* ctx,
    JSObjectList* s,
    uint32_t new_hash_size) {
  JSObjectListEntry* e;
  uint32_t i, h, *new_hash_table;

  new_hash_table = js_malloc(ctx, sizeof(new_hash_table[0]) * new_hash_size);
  if (!new_hash_table)
    return -1;
  js_free(ctx, s->hash_table);
  s->hash_table = new_hash_table;
  s->hash_size = new_hash_size;

  for (i = 0; i < s->hash_size; i++) {
    s->hash_table[i] = -1;
  }
  for (i = 0; i < s->object_count; i++) {
    e = &s->object_tab[i];
    h = js_object_list_get_hash(e->obj, s->hash_size);
    e->hash_next = s->hash_table[h];
    s->hash_table[h] = i;
  }
  return 0;
}

/* the reference count of 'obj' is not modified. Return 0 if OK, -1 if
   memory error */
int js_object_list_add(JSContext* ctx, JSObjectList* s, JSObject* obj) {
  JSObjectListEntry* e;
  uint32_t h, new_hash_size;

  if (js_resize_array(
          ctx,
          (void*)&s->object_tab,
          sizeof(s->object_tab[0]),
          &s->object_size,
          s->object_count + 1))
    return -1;
  if (unlikely((s->object_count + 1) >= s->hash_size)) {
    new_hash_size = max_uint32(s->hash_size, 4);
    while (new_hash_size <= s->object_count)
      new_hash_size *= 2;
    if (js_object_list_resize_hash(ctx, s, new_hash_size))
      return -1;
  }
  e = &s->object_tab[s->object_count++];
  h = js_object_list_get_hash(obj, s->hash_size);
  e->obj = obj;
  e->hash_next = s->hash_table[h];
  s->hash_table[h] = s->object_count - 1;
  return 0;
}

/* return -1 if not present or the object index */
int js_object_list_find(JSContext* ctx, JSObjectList* s, JSObject* obj) {
  JSObjectListEntry* e;
  uint32_t h, p;

  /* must test empty size because there is no hash table */
  if (s->object_count == 0)
    return -1;
  h = js_object_list_get_hash(obj, s->hash_size);
  p = s->hash_table[h];
  while (p != -1) {
    e = &s->object_tab[p];
    if (e->obj == obj)
      return p;
    p = e->hash_next;
  }
  return -1;
}

void js_object_list_end(JSContext* ctx, JSObjectList* s) {
  js_free(ctx, s->object_tab);
  js_free(ctx, s->hash_table);
}

/* indicate that the object may be part of a function prototype cycle */
void set_cycle_flag(JSContext* ctx, JSValueConst obj) {}

void remove_gc_object(JSGCObjectHeader* h) {
  list_del(&h->link);
}

void free_var_ref(JSRuntime* rt, JSVarRef* var_ref) {
  if (var_ref) {
    JS_ASSERT(var_ref->header.ref_count > 0);
    if (--var_ref->header.ref_count == 0) {
      if (var_ref->is_detached) {
        JS_FreeValueRT(rt, var_ref->value);
      } else {
        list_del(&var_ref->var_ref_link); /* still on the stack */
        if (var_ref->async_func)
          async_func_free(rt, var_ref->async_func);
      }
      remove_gc_object(&var_ref->header);
      js_free_rt(rt, var_ref);
    }
  }
}

void free_object(JSRuntime* rt, JSObject* p) {
  int i;
  JSClassFinalizer* finalizer;
  JSShape* sh;
  JSShapeProperty* pr;

  p->free_mark = 1; /* used to tell the object is invalid when
                       freeing cycles */
  /* free all the fields */
  sh = p->shape;
  pr = get_shape_prop(sh);
  for (i = 0; i < sh->prop_count; i++) {
    free_property(rt, &p->prop[i], pr->flags);
    pr++;
  }
  js_free_rt(rt, p->prop);
  /* as an optimization we destroy the shape immediately without
     putting it in gc_zero_ref_count_list */
  js_free_shape(rt, sh);

  /* fail safe */
  p->shape = NULL;
  p->prop = NULL;

  finalizer = rt->class_array[p->class_id].finalizer;
  if (finalizer)
    (*finalizer)(rt, JS_MKPTR(JS_TAG_OBJECT, p));

  /* fail safe */
  p->class_id = 0;
  p->u.opaque = NULL;
  p->u.func.var_refs = NULL;
  p->u.func.home_object = NULL;

  remove_gc_object(&p->header);
  if (rt->gc_phase == JS_GC_PHASE_REMOVE_CYCLES) {
    if (p->header.ref_count == 0 && p->weakref_count == 0) {
      js_free_rt(rt, p);
    } else {
      /* keep the object structure because there are may be
         references to it */
      list_add_tail(&p->header.link, &rt->gc_zero_ref_count_list);
    }
  } else {
    /* keep the object structure in case there are weak references to it */
    if (p->weakref_count == 0) {
      js_free_rt(rt, p);
    } else {
      p->header.mark = 0; /* reset the mark so that the weakref can be freed */
    }
  }
}

void async_func_free_frame(JSRuntime* rt, JSAsyncFunctionState* s) {
  JSStackFrame* sf = &s->frame;
  JSValue* sp;

  if (sf->arg_buf) {
    /* cannot free the function if it is running */
    JS_ASSERT(sf->cur_sp != NULL);
    for (sp = sf->arg_buf; sp < sf->cur_sp; sp++) {
      JS_FreeValueRT(rt, *sp);
    }
    js_free_rt(rt, sf->arg_buf);
    sf->arg_buf = NULL;
  }
  JS_FreeValueRT(rt, sf->cur_func);
  JS_FreeValueRT(rt, s->this_val);
}

static void __async_func_free(JSRuntime* rt, JSAsyncFunctionState* s) {
  /* cannot close the closure variables here because it would
     potentially modify the object graph */
  if (!s->is_completed) {
    async_func_free_frame(rt, s);
  }

  JS_FreeValueRT(rt, s->resolving_funcs[0]);
  JS_FreeValueRT(rt, s->resolving_funcs[1]);

  remove_gc_object(&s->header);
  if (rt->gc_phase == JS_GC_PHASE_REMOVE_CYCLES && s->header.ref_count != 0) {
    list_add_tail(&s->header.link, &rt->gc_zero_ref_count_list);
  } else {
    js_free_rt(rt, s);
  }
}

void free_gc_object(JSRuntime* rt, JSGCObjectHeader* gp) {
  switch (gp->gc_obj_type) {
    case JS_GC_OBJ_TYPE_JS_OBJECT:
      free_object(rt, (JSObject*)gp);
      break;
    case JS_GC_OBJ_TYPE_FUNCTION_BYTECODE:
      free_function_bytecode(rt, (JSFunctionBytecode*)gp);
      break;
    case JS_GC_OBJ_TYPE_ASYNC_FUNCTION:
      __async_func_free(rt, (JSAsyncFunctionState*)gp);
      break;
    case JS_GC_OBJ_TYPE_MODULE:
      js_free_module_def(rt, (JSModuleDef *)gp);
      break;
    default:
      abort();
  }
}

void free_zero_refcount(JSRuntime* rt) {
  struct list_head* el;
  JSGCObjectHeader* p;

  rt->gc_phase = JS_GC_PHASE_DECREF;
  for (;;) {
    el = rt->gc_zero_ref_count_list.next;
    if (el == &rt->gc_zero_ref_count_list)
      break;
    p = list_entry(el, JSGCObjectHeader, link);
    JS_ASSERT(p->ref_count == 0);
    free_gc_object(rt, p);
  }
  rt->gc_phase = JS_GC_PHASE_NONE;
}

/* called with the ref_count of 'v' reaches zero. */
void __JS_FreeValueRT(JSRuntime* rt, JSValue v) {
  uint32_t tag = JS_VALUE_GET_TAG(v);

  if (tag == JS_TAG_OBJECT && rt->free_recall_fun != NULL &&
      JS_VALUE_GET_OBJ(v)->free_recall) {
    rt->free_recall_fun(rt, &v, rt->free_recall_fun_context);
  }

#ifdef DUMP_FREE
  {
    printf("Freeing ");
    if (tag == JS_TAG_OBJECT) {
      JS_DumpObject(rt, JS_VALUE_GET_OBJ(v));
    } else {
      JS_DumpValueShort(rt, v);
      printf("\n");
    }
  }
#endif

  switch (tag) {
    case JS_TAG_STRING: {
      JSString* p = JS_VALUE_GET_STRING(v);
      if (p->atom_type) {
        JS_FreeAtomStruct(rt, p);
      } else {
#ifdef DUMP_LEAKS
        list_del(&p->link);
#endif
        js_free_rt(rt, p);
      }
    } break;
    case JS_TAG_STRING_ROPE:
      /* Note: recursion is acceptable because the rope depth is bounded */
      {
        JSStringRope* p = JS_VALUE_GET_STRING_ROPE(v);
        JS_FreeValueRT(rt, p->left);
        JS_FreeValueRT(rt, p->right);
        js_free_rt(rt, p);
      }
      break;
    case JS_TAG_OBJECT:
    case JS_TAG_FUNCTION_BYTECODE:
    case JS_TAG_MODULE: {
      JSGCObjectHeader* p = JS_VALUE_GET_PTR(v);
      if (rt->gc_phase != JS_GC_PHASE_REMOVE_CYCLES) {
        list_del(&p->link);
        list_add(&p->link, &rt->gc_zero_ref_count_list);
        p->mark = 1; /* indicate that the object is about to be freed */
        if (rt->gc_phase == JS_GC_PHASE_NONE) {
          free_zero_refcount(rt);
        }
      }
    } break;
    case JS_TAG_BIG_INT: {
      JSBigInt* p = JS_VALUE_GET_PTR(v);
      js_free_rt(rt, p);
    } break;
    case JS_TAG_SYMBOL: {
      JSAtomStruct* p = JS_VALUE_GET_PTR(v);
      JS_FreeAtomStruct(rt, p);
    } break;
    default:
      abort();
  }
}

void __JS_FreeValue(JSContext* ctx, JSValue v) {
  __JS_FreeValueRT(ctx->rt, v);
}

void JS_FreeValue(JSContext* ctx, JSValue v) {
  if (JS_VALUE_HAS_REF_COUNT(v)) {
    JSRefCountHeader* p = (JSRefCountHeader*)JS_VALUE_GET_PTR(v);
    JS_ASSERT_CONTEXT(ctx, p->ref_count > 0);
    if (--p->ref_count <= 0) {
      __JS_FreeValue(ctx, v);
    }
  }
}

/* garbage collection */

void gc_remove_weak_objects(JSRuntime* rt) {
  struct list_head* el;

  /* add the freed objects to rt->gc_zero_ref_count_list so that
     rt->weakref_list is not modified while we traverse it */
  rt->gc_phase = JS_GC_PHASE_DECREF;

  list_for_each(el, &rt->weakref_list) {
    JSWeakRefHeader* wh = list_entry(el, JSWeakRefHeader, link);
    switch (wh->weakref_type) {
      case JS_WEAKREF_TYPE_MAP:
        map_delete_weakrefs(rt, wh);
        break;
      case JS_WEAKREF_TYPE_WEAKREF:
        weakref_delete_weakref(rt, wh);
        break;
      case JS_WEAKREF_TYPE_FINREC:
        finrec_delete_weakref(rt, wh);
        break;
      default:
        abort();
    }
  }

  rt->gc_phase = JS_GC_PHASE_NONE;
  /* free the freed objects here. */
  free_zero_refcount(rt);
}

void add_gc_object(
    JSRuntime* rt,
    JSGCObjectHeader* h,
    JSGCObjectTypeEnum type) {
  h->mark = 0;
  h->gc_obj_type = type;
  list_add_tail(&h->link, &rt->gc_obj_list);
}

void JS_MarkValue(JSRuntime* rt, JSValueConst val, JS_MarkFunc* mark_func) {
  if (JS_VALUE_HAS_REF_COUNT(val)) {
    switch (JS_VALUE_GET_TAG(val)) {
      case JS_TAG_OBJECT:
      case JS_TAG_FUNCTION_BYTECODE:
      case JS_TAG_MODULE:
        mark_func(rt, JS_VALUE_GET_PTR(val));
        break;
      default:
        break;
    }
  }
}

/* XXX: would be more efficient with separate module lists */
void js_free_modules(JSContext* ctx, JSFreeModuleEnum flag) {
  struct list_head *el, *el1;
  list_for_each_safe(el, el1, &ctx->loaded_modules) {
    JSModuleDef* m = list_entry(el, JSModuleDef, link);
    if (flag == JS_FREE_MODULE_ALL ||
        (flag == JS_FREE_MODULE_NOT_RESOLVED && !m->resolved) ||
        (flag == JS_FREE_MODULE_NOT_EVALUATED && !m->evaluated)) {
      /* warning: the module may be referenced elsewhere. It
          could be simpler to use an array instead of a list for
          'ctx->loaded_modules' */
      list_del(&m->link);
      m->link.prev = NULL;
      m->link.next = NULL;
      JS_FreeValue(ctx, JS_MKPTR(JS_TAG_MODULE, m));
    }
  }
}

JSContext* JS_DupContext(JSContext* ctx) {
  ctx->header.ref_count++;
  return ctx;
}

/* used by the GC */
void JS_MarkContext(JSRuntime* rt, JSContext* ctx, JS_MarkFunc* mark_func) {
  int i;
  struct list_head* el;

  list_for_each(el, &ctx->loaded_modules) {
    JSModuleDef* m = list_entry(el, JSModuleDef, link);
    JS_MarkValue(rt, JS_MKPTR(JS_TAG_MODULE, m), mark_func);
  }

  JS_MarkValue(rt, ctx->global_obj, mark_func);
  JS_MarkValue(rt, ctx->global_var_obj, mark_func);

  JS_MarkValue(rt, ctx->throw_type_error, mark_func);
  JS_MarkValue(rt, ctx->eval_obj, mark_func);

  JS_MarkValue(rt, ctx->array_proto_values, mark_func);
  for (i = 0; i < JS_NATIVE_ERROR_COUNT; i++) {
    JS_MarkValue(rt, ctx->native_error_proto[i], mark_func);
  }
  for (i = 0; i < rt->class_count; i++) {
    JS_MarkValue(rt, ctx->class_proto[i], mark_func);
  }
  JS_MarkValue(rt, ctx->iterator_proto, mark_func);
  JS_MarkValue(rt, ctx->async_iterator_proto, mark_func);
  JS_MarkValue(rt, ctx->promise_ctor, mark_func);
  JS_MarkValue(rt, ctx->array_ctor, mark_func);
  JS_MarkValue(rt, ctx->regexp_ctor, mark_func);
  JS_MarkValue(rt, ctx->function_ctor, mark_func);
  JS_MarkValue(rt, ctx->function_proto, mark_func);

  if (ctx->array_shape)
    mark_func(rt, &ctx->array_shape->header);
}

void mark_children(
    JSRuntime* rt,
    JSGCObjectHeader* gp,
    JS_MarkFunc* mark_func) {
  switch (gp->gc_obj_type) {
    case JS_GC_OBJ_TYPE_JS_OBJECT: {
      JSObject* p = (JSObject*)gp;
      JSShapeProperty* prs;
      JSShape* sh;
      int i;
      sh = p->shape;
      mark_func(rt, &sh->header);
      /* mark all the fields */
      prs = get_shape_prop(sh);
      for (i = 0; i < sh->prop_count; i++) {
        JSProperty* pr = &p->prop[i];
        if (prs->atom != JS_ATOM_NULL) {
          if (prs->flags & JS_PROP_TMASK) {
            if ((prs->flags & JS_PROP_TMASK) == JS_PROP_GETSET) {
              if (pr->u.getset.getter)
                mark_func(rt, &pr->u.getset.getter->header);
              if (pr->u.getset.setter)
                mark_func(rt, &pr->u.getset.setter->header);
            } else if ((prs->flags & JS_PROP_TMASK) == JS_PROP_VARREF) {
              if (pr->u.var_ref->is_detached) {
                /* Note: the tag does not matter
                   provided it is a GC object */
                mark_func(rt, &pr->u.var_ref->header);
              }
            } else if ((prs->flags & JS_PROP_TMASK) == JS_PROP_AUTOINIT) {
              js_autoinit_mark(rt, pr, mark_func);
            }
          } else {
            JS_MarkValue(rt, pr->u.value, mark_func);
          }
        }
        prs++;
      }

      if (p->class_id != JS_CLASS_OBJECT) {
        JSClassGCMark* gc_mark;
        gc_mark = rt->class_array[p->class_id].gc_mark;
        if (gc_mark)
          gc_mark(rt, JS_MKPTR(JS_TAG_OBJECT, p), mark_func);
      }
    } break;
    case JS_GC_OBJ_TYPE_FUNCTION_BYTECODE:
      /* the template objects can be part of a cycle */
      {
        int i, j;
        InlineCacheRingItem* buffer;
        JSFunctionBytecode* b = (JSFunctionBytecode*)gp;
        for (i = 0; i < b->cpool_count; i++) {
          JS_MarkValue(rt, b->cpool[i], mark_func);
        }
        if (b->realm)
          mark_func(rt, &b->realm->header);
        if (b->ic) {
          for (i = 0; i < b->ic->count; i++) {
            buffer = b->ic->cache[i].buffer;
            for (j = 0; j < IC_CACHE_ITEM_CAPACITY; j++) {
              if (buffer[j].shape)
                mark_func(rt, &buffer[j].shape->header);
              if (buffer[j].proto)
                mark_func(rt, &buffer[j].proto->header);
            }
          }
        }
      }
      break;
    case JS_GC_OBJ_TYPE_VAR_REF: {
      JSVarRef* var_ref = (JSVarRef*)gp;
      if (var_ref->is_detached) {
        JS_MarkValue(rt, *var_ref->pvalue, mark_func);
      } else if (var_ref->async_func) {
        mark_func(rt, &var_ref->async_func->header);
      }
    } break;
    case JS_GC_OBJ_TYPE_ASYNC_FUNCTION: {
      JSAsyncFunctionState* s = (JSAsyncFunctionState*)gp;
      JSStackFrame* sf = &s->frame;
      JSValue* sp;

      if (!s->is_completed) {
        JS_MarkValue(rt, sf->cur_func, mark_func);
        JS_MarkValue(rt, s->this_val, mark_func);
        /* sf->cur_sp = NULL if the function is running */
        if (sf->cur_sp) {
          /* if the function is running, cur_sp is not known so we
             cannot mark the stack. Marking the variables is not needed
             because a running function cannot be part of a removable
             cycle */
          for (sp = sf->arg_buf; sp < sf->cur_sp; sp++)
            JS_MarkValue(rt, *sp, mark_func);
        }
      }
      JS_MarkValue(rt, s->resolving_funcs[0], mark_func);
      JS_MarkValue(rt, s->resolving_funcs[1], mark_func);
    } break;
    case JS_GC_OBJ_TYPE_SHAPE: {
      JSShape* sh = (JSShape*)gp;
      if (sh->proto != NULL) {
        mark_func(rt, &sh->proto->header);
      }
    } break;
    case JS_GC_OBJ_TYPE_JS_CONTEXT: {
      JSContext* ctx = (JSContext*)gp;
      JS_MarkContext(rt, ctx, mark_func);
    } break;
    case JS_GC_OBJ_TYPE_MODULE: {
      JSModuleDef* m = (JSModuleDef*)gp;
      js_mark_module_def(rt, m, mark_func);
    } break;
    default:
      abort();
  }
}

void gc_decref_child(JSRuntime* rt, JSGCObjectHeader* p) {
  if (p->ref_count <= 0) {
    JS_DumpObject(rt, (JSObject*)p); // FIXME @wzq
  }
  JS_ASSERT(p->ref_count > 0);
  p->ref_count--;
  if (p->ref_count == 0 && p->mark == 1) {
    list_del(&p->link);
    list_add_tail(&p->link, &rt->tmp_obj_list);
  }
}

void gc_decref(JSRuntime* rt) {
  struct list_head *el, *el1;
  JSGCObjectHeader* p;

  init_list_head(&rt->tmp_obj_list);

  /* decrement the refcount of all the children of all the GC
     objects and move the GC objects with zero refcount to
     tmp_obj_list */
  list_for_each_safe(el, el1, &rt->gc_obj_list) {
    p = list_entry(el, JSGCObjectHeader, link);
    JS_ASSERT(p->mark == 0);
    mark_children(rt, p, gc_decref_child);
    p->mark = 1;
    if (p->ref_count == 0) {
      list_del(&p->link);
      list_add_tail(&p->link, &rt->tmp_obj_list);
    }
  }
}

void gc_scan_incref_child(JSRuntime* rt, JSGCObjectHeader* p) {
  p->ref_count++;
  if (p->ref_count == 1) {
    /* ref_count was 0: remove from tmp_obj_list and add at the
       end of gc_obj_list */
    list_del(&p->link);
    list_add_tail(&p->link, &rt->gc_obj_list);
    p->mark = 0; /* reset the mark for the next GC call */
  }
}

void gc_scan_incref_child2(JSRuntime* rt, JSGCObjectHeader* p) {
  p->ref_count++;
}

void gc_scan(JSRuntime* rt) {
  struct list_head* el;
  JSGCObjectHeader* p;

  /* keep the objects with a refcount > 0 and their children. */
  list_for_each(el, &rt->gc_obj_list) {
    p = list_entry(el, JSGCObjectHeader, link);
    JS_ASSERT(p->ref_count > 0);
    p->mark = 0; /* reset the mark for the next GC call */
    mark_children(rt, p, gc_scan_incref_child);
  }

  /* restore the refcount of the objects to be deleted. */
  list_for_each(el, &rt->tmp_obj_list) {
    p = list_entry(el, JSGCObjectHeader, link);
    mark_children(rt, p, gc_scan_incref_child2);
  }
}

void gc_free_cycles(JSRuntime* rt) {
  struct list_head *el, *el1;
  JSGCObjectHeader* p;
#ifdef DUMP_GC_FREE
  BOOL header_done = FALSE;
#endif

  rt->gc_phase = JS_GC_PHASE_REMOVE_CYCLES;

  for (;;) {
    el = rt->tmp_obj_list.next;
    if (el == &rt->tmp_obj_list)
      break;
    p = list_entry(el, JSGCObjectHeader, link);
    /* Only need to free the GC object associated with JS values
       or async functions. The rest will be automatically removed
       because they must be referenced by them. */
    switch (p->gc_obj_type) {
      case JS_GC_OBJ_TYPE_JS_OBJECT:
      case JS_GC_OBJ_TYPE_FUNCTION_BYTECODE:
      case JS_GC_OBJ_TYPE_ASYNC_FUNCTION:
      case JS_GC_OBJ_TYPE_MODULE:
#ifdef DUMP_GC_FREE
        if (!header_done) {
          printf("Freeing cycles:\n");
          JS_DumpObjectHeader(rt);
          header_done = TRUE;
        }
        JS_DumpGCObject(rt, p);
#endif
        free_gc_object(rt, p);
        break;
      default:
        list_del(&p->link);
        list_add_tail(&p->link, &rt->gc_zero_ref_count_list);
        break;
    }
  }
  rt->gc_phase = JS_GC_PHASE_NONE;

  list_for_each_safe(el, el1, &rt->gc_zero_ref_count_list) {
    p = list_entry(el, JSGCObjectHeader, link);
    JS_ASSERT(
        p->gc_obj_type == JS_GC_OBJ_TYPE_JS_OBJECT ||
        p->gc_obj_type == JS_GC_OBJ_TYPE_FUNCTION_BYTECODE ||
        p->gc_obj_type == JS_GC_OBJ_TYPE_ASYNC_FUNCTION ||
        p->gc_obj_type == JS_GC_OBJ_TYPE_MODULE);
    if (p->gc_obj_type == JS_GC_OBJ_TYPE_JS_OBJECT &&
        ((JSObject*)p)->weakref_count != 0) {
      /* keep the object because there are weak references to it */
      p->mark = 0;
    } else {
      js_free_rt(rt, p);
    }
  }

  init_list_head(&rt->gc_zero_ref_count_list);
}

void JS_RunGCInternal(JSRuntime* rt, BOOL remove_weak_objects) {
  if (remove_weak_objects) {
    /* free the weakly referenced object or symbol structures, delete
       the associated Map/Set entries and queue the finalization
       registry callbacks. */
    gc_remove_weak_objects(rt);
  }

  /* decrement the reference of the children of each object. mark =
     1 after this pass. */
  gc_decref(rt);

  /* keep the GC objects with a non zero refcount and their childs */
  gc_scan(rt);

  /* free the GC objects in a cycle */
  gc_free_cycles(rt);
}

void JS_RunGC(JSRuntime* rt) {
  JS_RunGCInternal(rt, TRUE);
}

void JS_TurnOffGC(JSRuntime* rt) {
  rt->gc_off = TRUE;
}

void JS_TurnOnGC(JSRuntime* rt) {
  rt->gc_off = FALSE;
}

/* Return false if not an object or if the object has already been
   freed (zombie objects are visible in finalizers when freeing
   cycles). */
BOOL JS_IsLiveObject(JSRuntime* rt, JSValueConst obj) {
  JSObject* p;
  if (!JS_IsObject(obj))
    return FALSE;
  p = JS_VALUE_GET_OBJ(obj);
  return !p->free_mark;
}
