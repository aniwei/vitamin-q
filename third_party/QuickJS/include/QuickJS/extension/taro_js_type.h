#pragma once

#include "QuickJS/common.h"

static inline JS_BOOL taro_is_number(JSValueConst v) {
  int tag = JS_VALUE_GET_TAG(v);
  return tag == JS_TAG_INT || JS_TAG_IS_FLOAT64(tag);
}

static inline JS_BOOL taro_is_int(JSValueConst v) {
  int tag = JS_VALUE_GET_TAG(v);
  return tag == JS_TAG_INT;
}

static inline JS_BOOL taro_is_double(JSValueConst v) {
  int tag = JS_VALUE_GET_TAG(v);
  return JS_TAG_IS_FLOAT64(tag);
}

static inline JS_BOOL taro_is_big_int(JSContext* ctx, JSValueConst v) {
  int tag = JS_VALUE_GET_TAG(v);
  return tag == JS_TAG_BIG_INT || tag == JS_TAG_SHORT_BIG_INT;
}

static inline JS_BOOL taro_is_bool(JSValueConst v) {
  return JS_VALUE_GET_TAG(v) == JS_TAG_BOOL;
}

static inline JS_BOOL taro_is_null(JSValueConst v) {
  return JS_VALUE_GET_TAG(v) == JS_TAG_NULL;
}

static inline JS_BOOL taro_is_undefined(JSValueConst v) {
  return JS_VALUE_GET_TAG(v) == JS_TAG_UNDEFINED;
}

static inline JS_BOOL taro_is_exception(JSValueConst v) {
  return js_unlikely(JS_VALUE_GET_TAG(v) == JS_TAG_EXCEPTION);
}

static inline JS_BOOL taro_is_uninitialized(JSValueConst v) {
  return js_unlikely(JS_VALUE_GET_TAG(v) == JS_TAG_UNINITIALIZED);
}

static inline JS_BOOL taro_is_string(JSValueConst v) {
  return JS_VALUE_GET_TAG(v) == JS_TAG_STRING ||
    JS_VALUE_GET_TAG(v) == JS_TAG_STRING_ROPE;
}

static inline JS_BOOL taro_is_symbol(JSValueConst v) {
  return JS_VALUE_GET_TAG(v) == JS_TAG_SYMBOL;
}

static inline JS_BOOL taro_is_object(JSValueConst v) {
  return JS_VALUE_GET_TAG(v) == JS_TAG_OBJECT;
}

static inline JS_BOOL taro_is_module_def(JSValueConst v) {
  return JS_VALUE_GET_TAG(v) == JS_TAG_MODULE;
}

JS_BOOL taro_is_array(JSContext* ctx, JSValueConst val);

JS_BOOL taro_is_array_buffer(JSContext* ctx, JSValueConst val);

#ifdef __cplusplus
extern "C" {
#endif
JS_BOOL taro_is_error(JSContext* ctx, JSValueConst val);

JS_BOOL taro_is_function(JSContext* ctx, JSValueConst val);

#ifdef __cplusplus
} /* extern "C" { */
#endif

JS_BOOL taro_is_constructor(JSContext* ctx, JSValueConst val);

JS_BOOL taro_is_extensible(JSContext* ctx, JSValueConst obj);

JS_BOOL taro_is_instance_of(JSContext* ctx, JSValueConst val, JSValueConst obj);

JS_BOOL taro_is_live_object(JSRuntime* rt, JSValueConst obj);

JS_BOOL taro_is_registered_class(JSRuntime* rt, JSClassID class_id);

JS_BOOL taro_is_job_pending(JSRuntime* rt);
