#pragma once

#include "QuickJS/quickjs.h"
#include "exception.h"
#include "shape.h"
#include "types.h"

#ifdef __cplusplus
extern "C" {
#endif

InlineCache* init_ic(JSContext* ctx);
int rebuild_ic(InlineCache* ic);
int resize_ic_hash(InlineCache* ic);
int free_ic(InlineCache* ic);

int ic_watchpoint_delete_handler(
    JSRuntime* rt,
    intptr_t ref,
    JSAtom atom,
    void* target);
int ic_watchpoint_free_handler(JSRuntime* rt, intptr_t ref, JSAtom atom);
int ic_delete_shape_proto_watchpoints(
    JSRuntime* rt,
    JSShape* shape,
    JSAtom atom);
int ic_free_shape_proto_watchpoints(JSRuntime* rt, JSShape* shape);

#ifdef __cplusplus
}
#endif

static force_inline uint32_t get_index_hash(JSAtom atom, int hash_bits) {
  return (atom * 0x9e370001) >> (32 - hash_bits);
}

static force_inline JSAtom get_ic_atom(InlineCache* ic, uint32_t cache_offset) {
  JS_ASSERT(cache_offset < ic->capacity);
  return ic->cache[cache_offset].atom;
}

static force_inline uint32_t add_ic_slot(
    InlineCache* ic,
    JSAtom atom,
    JSObject* object,
    uint32_t prop_offset,
    JSObject* prototype) {
  InlineCacheHashSlot* ch;
  InlineCacheRingSlot* cr = NULL;
  JSRuntime* rt = ic->ctx->rt;
  uint32_t h = get_index_hash(atom, ic->hash_bits);

  for (ch = ic->hash[h]; ch != NULL; ch = ch->next) {
    if (likely(ch->atom == atom)) {
      cr = &ic->cache[ch->index];
      break;
    }
  }

  // JS_ASSERT(cr != NULL);
  if (unlikely(cr == NULL)) {
    printf("add_ic_slot: atom=%d cache ring no found.\n", atom);
    return -1;
  }

  InlineCacheRingItem* ci;
  int32_t i = cr->index;
  JSShape* sh;
  for (;;) {
    ci = cr->buffer + i;
    if (object->shape == ci->shape && prototype == ci->proto) {
      ci->prop_offset = prop_offset;
      goto end;
    }

    i = (i + 1) % IC_CACHE_ITEM_CAPACITY;
    if (unlikely(i == cr->index)) {
      cr->index = (cr->index + 1) % IC_CACHE_ITEM_CAPACITY;
      break;
    }
  }

  ci = cr->buffer + cr->index;
  sh = ci->shape;
  if (ci->watchpoint_ref)
    // must be called before js_free_shape_null
    js_shape_delete_watchpoints(rt, sh, ci);
  ci->prop_offset = prop_offset;
  ci->shape = js_dup_shape(object->shape);
  js_free_shape_null(rt, sh);
  if (prototype) {
    // the atom and prototype SHOULE BE freed by
    // watchpoint_remove/clear_callback
    JS_DupValue(ic->ctx, JS_MKPTR(JS_TAG_OBJECT, prototype));
    ci->proto = prototype;
    ci->watchpoint_ref = js_shape_create_watchpoint(
        rt,
        ci->shape,
        (intptr_t)ci,
        JS_DupAtom(ic->ctx, atom),
        ic_watchpoint_delete_handler,
        ic_watchpoint_free_handler);
  }
end:
  return ch->index;
}

static force_inline uint32_t add_ic_slot1(InlineCache* ic, JSAtom atom) {
  uint32_t h;
  InlineCacheHashSlot* ch;
  if (ic->count + 1 >= ic->capacity && resize_ic_hash(ic))
    goto fail;
  h = get_index_hash(atom, ic->hash_bits);
  for (ch = ic->hash[h]; ch != NULL; ch = ch->next) {
    if (likely(ch->atom == atom))
      goto fail;
  }
  ch = (InlineCacheHashSlot*)js_malloc(ic->ctx, sizeof(InlineCacheHashSlot));
  if (unlikely(!ch))
    goto fail;
  ch->atom = JS_DupAtom(ic->ctx, atom);
  ch->index = 0;
  ch->next = ic->hash[h];
  ic->hash[h] = ch;
  ic->count += 1;
  return 0;
fail:
  return -1;
}

static force_inline int32_t get_ic_prop_offset(
    InlineCache* ic,
    int32_t cache_offset,
    JSShape* shape,
    JSObject** prototype) {
  if (unlikely(cache_offset < 0 || !shape))
    return -1;

  uint32_t i;
  InlineCacheRingSlot* cr;
  InlineCacheRingItem* buffer;
  JS_ASSERT(cache_offset < ic->capacity);
  cr = ic->cache + cache_offset;
  i = cr->index;
  for (;;) {
    buffer = cr->buffer + i;
    if (likely(buffer->shape == shape)) {
      cr->index = i;
      *prototype = buffer->proto;
      return buffer->prop_offset;
    }

    i = (i + 1) % IC_CACHE_ITEM_CAPACITY;
    if (unlikely(i == cr->index)) {
      break;
    }
  }

  *prototype = NULL;
  return -1;
}
