#include "ic.h"

#ifdef ANDROID_PRINT
#include <android/log.h>
#define printf(...) \
  __android_log_print(ANDROID_LOG_INFO, "QuickJS", __VA_ARGS__)
#endif

InlineCache* init_ic(JSContext* ctx) {
  InlineCache* ic;
  ic = (InlineCache*)js_malloc(ctx, sizeof(InlineCache));
  if (!ic) [[unlikely]]
    goto fail;
  ic->count = 0;
  ic->hash_bits = 2;
  ic->capacity = 1 << ic->hash_bits;
  ic->ctx = ctx;
  ic->hash =
      (InlineCacheHashSlot**)js_malloc(ctx, sizeof(ic->hash[0]) * ic->capacity);
  if (!ic->hash) [[unlikely]]
    goto fail;
  memset(ic->hash, 0, sizeof(ic->hash[0]) * ic->capacity);
  ic->cache = NULL;
  ic->updated = FALSE;
  ic->updated_offset = 0;
  return ic;
fail:
  return NULL;
}

int rebuild_ic(InlineCache* ic) {
  uint32_t i, count;
  InlineCacheHashSlot* ch;

  if (ic->count == 0)
    goto end;

  count = 0;
  ic->cache = (InlineCacheRingSlot*)js_malloc(
      ic->ctx, sizeof(InlineCacheRingSlot) * ic->count);
  if (!ic->cache) [[unlikely]]
    goto fail;

  memset(ic->cache, 0, sizeof(InlineCacheRingSlot) * ic->count);
  for (i = 0; i < ic->capacity; i++) {
    for (ch = ic->hash[i]; ch != NULL; ch = ch->next) {
      ch->index = count++;
      ic->cache[ch->index].atom = JS_DupAtom(ic->ctx, ch->atom);
      ic->cache[ch->index].index = 0;
    }
  }
end:
  return 0;
fail:
  return -1;
}

int resize_ic_hash(InlineCache* ic) {
  uint32_t new_capacity, i, h;
  InlineCacheHashSlot *ch, *ch_next;
  InlineCacheHashSlot** new_hash;
  ic->hash_bits += 1;
  new_capacity = 1 << ic->hash_bits;
  new_hash = (InlineCacheHashSlot**)js_malloc(
      ic->ctx, sizeof(ic->hash[0]) * new_capacity);
  if (!new_hash) [[unlikely]]
    goto fail;
  memset(new_hash, 0, sizeof(ic->hash[0]) * new_capacity);
  for (i = 0; i < ic->capacity; i++) {
    for (ch = ic->hash[i]; ch != NULL; ch = ch_next) {
      h = get_index_hash(ch->atom, ic->hash_bits);
      ch_next = ch->next;
      ch->next = new_hash[h];
      new_hash[h] = ch;
    }
  }
  js_free(ic->ctx, ic->hash);
  ic->hash = new_hash;
  ic->capacity = new_capacity;
  return 0;
fail:
  return -1;
}

int free_ic(InlineCache* ic) {
  uint32_t i, j;
  JSRuntime* rt;
  JSShape* sh;
  InlineCacheHashSlot *ch, *ch_next;
  InlineCacheRingItem* buffer;
  ICWatchpoint* o;
  rt = ic->ctx->rt;
  for (i = 0; i < ic->count; i++) {
    buffer = ic->cache[i].buffer;
    JS_FreeAtom(ic->ctx, ic->cache[i].atom);
    for (j = 0; j < IC_CACHE_ITEM_CAPACITY; j++) {
      sh = buffer[j].shape;
      o = buffer[j].watchpoint_ref;
      if (o) {
        if (o->free_callback)
          o->free_callback(rt, o->ref, o->atom);
        list_del(&o->link);
        js_free_rt(rt, o);
      }
      js_free_shape_null(rt, sh);
    }
  }
  for (i = 0; i < ic->capacity; i++) {
    for (ch = ic->hash[i]; ch != NULL; ch = ch_next) {
      ch_next = ch->next;
      JS_FreeAtom(ic->ctx, ch->atom);
      js_free(ic->ctx, ch);
    }
  }
  if (ic->count > 0)
    js_free(ic->ctx, ic->cache);
  js_free(ic->ctx, ic->hash);
  js_free(ic->ctx, ic);
  return 0;
}

int ic_watchpoint_delete_handler(
    JSRuntime* rt,
    intptr_t ref,
    JSAtom atom,
    void* target) {
  InlineCacheRingItem* ci;
  ci = (InlineCacheRingItem*)ref;
  if (ref != (intptr_t)target)
    return 1;
  JS_ASSERT(ci->proto != NULL);
  // the shape and prop_offset WILL BE handled by add_ic_slot
  // !!! MUST NOT CALL js_free_shape0 TO DOUBLE FREE HERE !!!
  JS_FreeValueRT(rt, JS_MKPTR(JS_TAG_OBJECT, ci->proto));
  JS_FreeAtomRT(rt, atom);
  ci->watchpoint_ref = NULL;
  ci->proto = NULL;
  ci->prop_offset = 0;
  ci->shape = NULL;
  return 0;
}

int ic_watchpoint_free_handler(JSRuntime* rt, intptr_t ref, JSAtom atom) {
  InlineCacheRingItem* ci;
  ci = (InlineCacheRingItem*)ref;
  JS_ASSERT(ci->watchpoint_ref != NULL);
  JS_ASSERT(ci->proto != NULL);
  // the watchpoint_clear_callback ONLY CAN BE called by js_free_shape0
  // !!! MUST NOT CALL js_free_shape0 TO DOUBLE FREE HERE !!!
  JS_FreeValueRT(rt, JS_MKPTR(JS_TAG_OBJECT, ci->proto));
  JS_FreeAtomRT(rt, atom);
  ci->watchpoint_ref = NULL;
  ci->proto = NULL;
  ci->prop_offset = 0;
  ci->shape = NULL;
  return 0;
}

int ic_delete_shape_proto_watchpoints(
    JSRuntime* rt,
    JSShape* shape,
    JSAtom atom) {
  struct list_head *el, *el1;
  JSObject* p;
  p = shape->proto;
  while (p) [[likely]] {
    if (p->shape->watchpoint)
      list_for_each_safe(el, el1, p->shape->watchpoint) {
        ICWatchpoint* o = list_entry(el, ICWatchpoint, link);
        if (o->atom == atom) {
          o->delete_callback = NULL;
          o->free_callback = NULL;
          ic_watchpoint_free_handler(rt, o->ref, o->atom);
          js_free_shape_null(rt, shape);
          list_del(el);
          js_free_rt(rt, o);
        }
      }
    p = p->shape->proto;
  }
  return 0;
}

int ic_free_shape_proto_watchpoints(JSRuntime* rt, JSShape* shape) {
  struct list_head *el, *el1;
  JSObject* p;
  p = shape->proto;
  while (p) [[likely]] {
    if (p->shape->watchpoint)
      list_for_each_safe(el, el1, p->shape->watchpoint) {
        ICWatchpoint* o = list_entry(el, ICWatchpoint, link);
        o->delete_callback = NULL;
        o->free_callback = NULL;
        ic_watchpoint_free_handler(rt, o->ref, o->atom);
        js_free_shape_null(rt, shape);
        list_del(el);
        js_free_rt(rt, o);
      }
    p = p->shape->proto;
  }
  return 0;
}
