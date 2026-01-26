#pragma once

#include <stdint.h>

#include "QuickJS/list.h"

/* define to include Atomics.* operations which depend on the OS
   threads */
#if !defined(EMSCRIPTEN)
#define CONFIG_ATOMICS
#endif

#if defined(__GNUC__) || defined(__clang__)
#define js_likely(x) __builtin_expect(!!(x), 1)
#define js_unlikely(x) __builtin_expect(!!(x), 0)
#define js_force_inline inline __attribute__((always_inline))
#define __js_printf_like(f, a) __attribute__((format(printf, f, a)))
#else
#define js_likely(x) (x)
#define js_unlikely(x) (x)
#ifdef _MSC_VER
#define js_force_inline __forceinline
#else
#define js_force_inline inline
#endif
#define __js_printf_like(a, b)
#endif

#define JS_BOOL int

typedef struct JSRuntime JSRuntime;
typedef struct JSContext JSContext;
typedef struct JSClass JSClass;
typedef uint32_t JSClassID;
typedef uint32_t JSAtom;

typedef struct JSShape JSShape;
typedef struct JSString JSString;
typedef struct JSString JSAtomStruct;
typedef struct JSObject JSObject;

#define JS_VALUE_GET_OBJ(v) ((JSObject *)JS_VALUE_GET_PTR(v))
#define JS_VALUE_GET_STRING(v) ((JSString *)JS_VALUE_GET_PTR(v))
#define JS_VALUE_GET_STRING_ROPE(v) ((JSStringRope *)JS_VALUE_GET_PTR(v))

typedef enum JSErrorEnum {
  JS_EVAL_ERROR,
  JS_RANGE_ERROR,
  JS_REFERENCE_ERROR,
  JS_SYNTAX_ERROR,
  JS_TYPE_ERROR,
  JS_URI_ERROR,
  JS_INTERNAL_ERROR,
  JS_AGGREGATE_ERROR,

  JS_NATIVE_ERROR_COUNT, /* number of different NativeError objects */
} JSErrorEnum;

typedef enum {
  JS_GC_OBJ_TYPE_JS_OBJECT,
  JS_GC_OBJ_TYPE_FUNCTION_BYTECODE,
  JS_GC_OBJ_TYPE_SHAPE,
  JS_GC_OBJ_TYPE_VAR_REF,
  JS_GC_OBJ_TYPE_ASYNC_FUNCTION,
  JS_GC_OBJ_TYPE_JS_CONTEXT,
  JS_GC_OBJ_TYPE_MODULE,
} JSGCObjectTypeEnum;

/* header for GC objects. GC objects are C data structures with a
   reference count that can reference other GC objects. JS Objects are
   a particular type of GC object. */
typedef struct JSGCObjectHeader {
  int ref_count; /* must come first, 32-bit */
  JSGCObjectTypeEnum gc_obj_type : 4;
  uint8_t mark : 4; /* used by the GC */
  uint8_t dummy1; /* not used by the GC */
  uint16_t dummy2; /* not used by the GC */
  struct list_head link;
} JSGCObjectHeader;

typedef enum {
    JS_WEAKREF_TYPE_MAP,
    JS_WEAKREF_TYPE_WEAKREF,
    JS_WEAKREF_TYPE_FINREC,
} JSWeakRefHeaderTypeEnum;

typedef struct {
    struct list_head link;
    JSWeakRefHeaderTypeEnum weakref_type;
} JSWeakRefHeader;

#if INTPTR_MAX >= INT64_MAX
#define JS_PTR64
#define JS_PTR64_DEF(a) a
#else
#define JS_PTR64_DEF(a)
#endif

#ifndef JS_PTR64
#define JS_NAN_BOXING
#endif

#if defined(__SIZEOF_INT128__) && (INTPTR_MAX >= INT64_MAX)
#define JS_LIMB_BITS 64
#else
#define JS_LIMB_BITS 32
#endif

#define JS_SHORT_BIG_INT_BITS JS_LIMB_BITS

#ifdef _MSC_VER
typedef size_t ssize_t;
#endif

typedef struct JSRefCountHeader {
  int ref_count;
} JSRefCountHeader;

#define JS_FLOAT64_NAN NAN

#define JS_VALUE_IS_BOTH_INT(v1, v2) \
  ((JS_VALUE_GET_TAG(v1) | JS_VALUE_GET_TAG(v2)) == 0)
#define JS_VALUE_IS_BOTH_FLOAT(v1, v2)        \
  (JS_TAG_IS_FLOAT64(JS_VALUE_GET_TAG(v1)) && \
   JS_TAG_IS_FLOAT64(JS_VALUE_GET_TAG(v2)))

#define JS_VALUE_HAS_REF_COUNT(v) \
  ((unsigned)JS_VALUE_GET_TAG(v) >= (unsigned)JS_TAG_FIRST)

enum {
  /* all tags with a reference count are negative */
  JS_TAG_FIRST = -9, /* first negative tag */
  JS_TAG_BIG_INT = -9,
  JS_TAG_SYMBOL = -8,
  JS_TAG_STRING = -7,
  JS_TAG_STRING_ROPE = -6,
  JS_TAG_MODULE = -3, /* used internally */
  JS_TAG_FUNCTION_BYTECODE = -2, /* used internally */
  JS_TAG_OBJECT = -1,

  JS_TAG_INT = 0,
  JS_TAG_BOOL = 1,
  JS_TAG_NULL = 2,
  JS_TAG_UNDEFINED = 3,
  JS_TAG_UNINITIALIZED = 4,
  JS_TAG_CATCH_OFFSET = 5,
  JS_TAG_EXCEPTION = 6,
  JS_TAG_SHORT_BIG_INT = 7,
  JS_TAG_FLOAT64 = 8,
  /* any larger tag is FLOAT64 if JS_NAN_BOXING */
};

#ifdef CONFIG_CHECK_JSVALUE
/* JSValue consistency : it is not possible to run the code in this
  mode, but it is useful to detect simple reference counting
  errors. It would be interesting to modify a static C analyzer to
  handle specific annotations (clang has such annotations but only
  for objective C) */
typedef struct __JSValue* JSValue;
typedef const struct __JSValue* JSValueConst;

#define JS_VALUE_GET_TAG(v) (int)((uintptr_t)(v)&0xf)
/* same as JS_VALUE_GET_TAG, but return JS_TAG_FLOAT64 with NaN boxing */
#define JS_VALUE_GET_NORM_TAG(v) JS_VALUE_GET_TAG(v)
#define JS_VALUE_GET_INT(v) (int)((intptr_t)(v) >> 4)
#define JS_VALUE_GET_BOOL(v) JS_VALUE_GET_INT(v)
#define JS_VALUE_GET_FLOAT64(v) (double)JS_VALUE_GET_INT(v)
#define JS_VALUE_GET_SHORT_BIG_INT(v) JS_VALUE_GET_INT(v)
#define JS_VALUE_GET_PTR(v) (void*)((intptr_t)(v) & ~0xf)

#define JS_MKVAL(tag, val) (JSValue)(intptr_t)(((val) << 4) | (tag))
#define JS_MKPTR(tag, p) (JSValue)((intptr_t)(p) | (tag))

#define JS_TAG_IS_FLOAT64(tag) ((unsigned)(tag) == JS_TAG_FLOAT64)

#define JS_NAN JS_MKVAL(JS_TAG_FLOAT64, 1)

static inline JSValue __JS_NewFloat64(JSContext* ctx, double d) {
  return JS_MKVAL(JS_TAG_FLOAT64, (int)d);
}

static inline JS_BOOL JS_VALUE_IS_NAN(JSValue v) {
  return 0;
}

static inline JSValue __JS_NewShortBigInt(JSContext* ctx, int32_t d) {
  return JS_MKVAL(JS_TAG_SHORT_BIG_INT, d);
}

#elif defined(JS_NAN_BOXING)

typedef uint64_t JSValue;

#define JSValueConst JSValue

#define JS_VALUE_GET_TAG(v) (int)((v) >> 32)
#define JS_VALUE_GET_INT(v) (int)(v)
#define JS_VALUE_GET_BOOL(v) (int)(v)
#define JS_VALUE_GET_SHORT_BIG_INT(v) (int)(v)
#define JS_VALUE_GET_PTR(v) (void*)(intptr_t)(v)

#define JS_MKVAL(tag, val) (((uint64_t)(tag) << 32) | (uint32_t)(val))
#define JS_MKPTR(tag, ptr) (((uint64_t)(tag) << 32) | (uintptr_t)(ptr))

#define JS_FLOAT64_TAG_ADDEND \
  (0x7ff80000 - JS_TAG_FIRST + 1) /* quiet NaN encoding */

static inline double JS_VALUE_GET_FLOAT64(JSValue v) {
  union {
    JSValue v;
    double d;
  } u;
  u.v = v;
  u.v += (uint64_t)JS_FLOAT64_TAG_ADDEND << 32;
  return u.d;
}

#define JS_NAN (0x7ff8000000000000 - ((uint64_t)JS_FLOAT64_TAG_ADDEND << 32))

static inline JSValue __JS_NewFloat64(JSContext* ctx, double d) {
  union {
    double d;
    uint64_t u64;
  } u;
  JSValue v;
  u.d = d;
  /* normalize NaN */
  if (js_unlikely((u.u64 & 0x7fffffffffffffff) > 0x7ff0000000000000))
    v = JS_NAN;
  else
    v = u.u64 - ((uint64_t)JS_FLOAT64_TAG_ADDEND << 32);
  return v;
}

#define JS_TAG_IS_FLOAT64(tag) \
  ((unsigned)((tag)-JS_TAG_FIRST) >= (JS_TAG_FLOAT64 - JS_TAG_FIRST))

/* same as JS_VALUE_GET_TAG, but return JS_TAG_FLOAT64 with NaN boxing */
static inline int JS_VALUE_GET_NORM_TAG(JSValue v) {
  uint32_t tag;
  tag = JS_VALUE_GET_TAG(v);
  if (JS_TAG_IS_FLOAT64(tag))
    return JS_TAG_FLOAT64;
  else
    return tag;
}

static inline JS_BOOL JS_VALUE_IS_NAN(JSValue v) {
  uint32_t tag;
  tag = JS_VALUE_GET_TAG(v);
  return tag == (JS_NAN >> 32);
}

static inline JSValue __JS_NewShortBigInt(JSContext* ctx, int32_t d) {
  return JS_MKVAL(JS_TAG_SHORT_BIG_INT, d);
}

#else /* !JS_NAN_BOXING */

typedef union JSValueUnion {
  int32_t int32;
  double float64;
  void* ptr;
#if JS_SHORT_BIG_INT_BITS == 32
  int32_t short_big_int;
#else
  int64_t short_big_int;
#endif
} JSValueUnion;

typedef struct JSValue {
  JSValueUnion u;
  int64_t tag;
} JSValue;

#define JSValueConst JSValue

#define JS_VALUE_GET_TAG(v) ((int32_t)(v).tag)
/* same as JS_VALUE_GET_TAG, but return JS_TAG_FLOAT64 with NaN boxing */
#define JS_VALUE_GET_NORM_TAG(v) JS_VALUE_GET_TAG(v)
#define JS_VALUE_GET_INT(v) ((v).u.int32)
#define JS_VALUE_GET_BOOL(v) ((v).u.int32)
#define JS_VALUE_GET_FLOAT64(v) ((v).u.float64)
#define JS_VALUE_GET_SHORT_BIG_INT(v) ((v).u.short_big_int)
#define JS_VALUE_GET_PTR(v) ((v).u.ptr)

#ifdef _MSC_VER
static inline JSValue JS_MKVAL(int tag, int32_t val) {
  JSValue v;
  v.u.int32 = val;
  v.tag = tag;
  return v;
}
static inline JSValue JS_MKPTR(int tag, void* val) {
  JSValue v;
  v.u.ptr = val;
  v.tag = tag;
  return v;
}
#else
#define JS_MKVAL(tag, val) \
  (JSValue) { (JSValueUnion){.int32 = val}, tag }
#define JS_MKPTR(tag, p) \
  (JSValue) { (JSValueUnion){.ptr = p}, tag }
#endif

#define JS_TAG_IS_FLOAT64(tag) ((unsigned)(tag) == JS_TAG_FLOAT64)

#define JS_NAN \
  (JSValue) { .u.float64 = JS_FLOAT64_NAN, JS_TAG_FLOAT64 }

static inline JSValue __JS_NewFloat64(JSContext* ctx, double d) {
  JSValue v;
  v.tag = JS_TAG_FLOAT64;
  v.u.float64 = d;
  return v;
}

static inline JS_BOOL JS_VALUE_IS_NAN(JSValue v) {
  union {
    double d;
    uint64_t u64;
  } u;
  if (v.tag != JS_TAG_FLOAT64)
    return 0;
  u.d = v.u.float64;
  return (u.u64 & 0x7fffffffffffffff) > 0x7ff0000000000000;
}

static inline JSValue __JS_NewShortBigInt(JSContext* ctx, int64_t d) {
  JSValue v;
  v.tag = JS_TAG_SHORT_BIG_INT;
  v.u.short_big_int = d;
  return v;
}

#endif /* !JS_NAN_BOXING */

typedef struct JSModuleDef JSModuleDef;

struct JSContext {
  JSGCObjectHeader header; /* must come first */
  JSRuntime* rt;
  struct list_head link;

  uint16_t binary_object_count;
  int binary_object_size;

  JSShape* array_shape; /* initial shape for Array objects */

  JSValue* class_proto;
  JSValue function_proto;
  JSValue function_ctor;
  JSValue array_ctor;
  JSValue regexp_ctor;
  JSValue promise_ctor;
  JSValue native_error_proto[JS_NATIVE_ERROR_COUNT];
  JSValue iterator_proto;
  JSValue async_iterator_proto;
  JSValue array_proto_values;
  JSValue throw_type_error;
  JSValue eval_obj;

  JSValue global_obj; /* global object */
  JSValue global_var_obj; /* contains the global let/const definitions */

  uint64_t random_state;

  /* when the counter reaches zero, JSRutime.interrupt_handler is called */
  int interrupt_counter;

  struct list_head loaded_modules; /* list of JSModuleDef.link */

  /* if NULL, RegExp compilation is not supported */
  JSValue (*compile_regexp)(
      JSContext* ctx,
      JSValueConst pattern,
      JSValueConst flags);
  /* if NULL, eval is not supported */
  JSValue (*eval_internal)(
      JSContext* ctx,
      JSValueConst this_obj,
      const char* input,
      size_t input_len,
      const char* filename,
      int flags,
      int scope_idx);
  void* user_opaque;
  int has_throw_exception;
};

typedef struct JSShapeProperty {
  uint32_t hash_next : 26; /* 0 if last in list */
  uint32_t flags : 6; /* JS_PROP_XXX */
  JSAtom atom; /* JS_ATOM_NULL = free property entry */
} JSShapeProperty;

struct JSShape {
  /* hash table of size hash_mask + 1 before the start of the
     structure (see prop_hash_end()). */
  JSGCObjectHeader header;
  /* true if the shape is inserted in the shape hash table. If not,
     JSShape.hash is not valid */
  uint8_t is_hashed;
  /* If true, the shape may have small array index properties 'n' with 0
     <= n <= 2^31-1. If false, the shape is guaranteed not to have
     small array index properties */
  uint8_t has_small_array_index;
  uint32_t hash; /* current hash value */
  uint32_t prop_hash_mask;
  int prop_size; /* allocated properties */
  int prop_count; /* include deleted properties */
  int deleted_prop_count;
  JSShape* shape_hash_next; /* in JSRuntime.shape_hash[h] list */
  JSObject* proto;
  struct list_head* watchpoint;
  JSShapeProperty prop[0]; /* prop_size elements */
};

struct JSClassDef;

/* special values */
#define JS_NULL JS_MKVAL(JS_TAG_NULL, 0)
#define JS_UNDEFINED JS_MKVAL(JS_TAG_UNDEFINED, 0)
#define JS_FALSE JS_MKVAL(JS_TAG_BOOL, 0)
#define JS_TRUE JS_MKVAL(JS_TAG_BOOL, 1)
#define JS_EXCEPTION JS_MKVAL(JS_TAG_EXCEPTION, 0)
#define JS_UNINITIALIZED JS_MKVAL(JS_TAG_UNINITIALIZED, 0)
