#pragma once

#include "QuickJS/quickjs.h"
#include "QuickJS/common.h"

#ifdef __cplusplus
extern "C" {
#endif

static inline int JS_IsNumber(JSValueConst v) {
  int tag = JS_VALUE_GET_TAG(v);
  return tag == JS_TAG_INT || JS_TAG_IS_FLOAT64(tag);
}

static inline int JS_IsBigInt(JSContext* ctx, JSValueConst v) {
  int tag = JS_VALUE_GET_TAG(v);
  return tag == JS_TAG_BIG_INT || tag == JS_TAG_SHORT_BIG_INT;
}

static inline int JS_IsBool(JSValueConst v) {
  return JS_VALUE_GET_TAG(v) == JS_TAG_BOOL;
}

static inline int JS_IsNull(JSValueConst v) {
  return JS_VALUE_GET_TAG(v) == JS_TAG_NULL;
}

static inline int JS_IsUndefined(JSValueConst v) {
  return JS_VALUE_GET_TAG(v) == JS_TAG_UNDEFINED;
}

static inline int JS_IsException(JSValueConst v) {
  return js_unlikely(JS_VALUE_GET_TAG(v) == JS_TAG_EXCEPTION);
}

static inline int JS_IsUninitialized(JSValueConst v) {
  return js_unlikely(JS_VALUE_GET_TAG(v) == JS_TAG_UNINITIALIZED);
}

static inline int JS_IsString(JSValueConst v) {
  return JS_VALUE_GET_TAG(v) == JS_TAG_STRING ||
    JS_VALUE_GET_TAG(v) == JS_TAG_STRING_ROPE;
}

static inline int JS_IsSymbol(JSValueConst v) {
  return JS_VALUE_GET_TAG(v) == JS_TAG_SYMBOL;
}

static inline int JS_IsObject(JSValueConst v) {
  return JS_VALUE_GET_TAG(v) == JS_TAG_OBJECT;
}

static inline int JS_IsModule(JSValueConst v) {
  return JS_VALUE_GET_TAG(v) == JS_TAG_MODULE;
}

int JS_IsError(JSContext* ctx, JSValueConst val);
int JS_IsFunction(JSContext* ctx, JSValueConst val);
int JS_IsConstructor(JSContext* ctx, JSValueConst val);
int JS_IsArray(JSContext* ctx, JSValueConst val);
int JS_IsArrayBuffer(JSContext* ctx, JSValueConst val);
int JS_IsExtensible(JSContext* ctx, JSValueConst obj);
int JS_IsInstanceOf(JSContext* ctx, JSValueConst val, JSValueConst obj);

int JS_IsLiveObject(JSRuntime* rt, JSValueConst obj);
int JS_IsRegisteredClass(JSRuntime* rt, JSClassID class_id);
int JS_IsJobPending(JSRuntime* rt);

#ifdef __cplusplus
} /* extern "C" { */
#endif
