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
#include "QuickJS/extension/debugger.h"
#include "QuickJS/list.h"
#include "QuickJS/quickjs.h"
#include "base.h"

#include "QuickJS/dtoa.h"

enum {
  /* classid tag        */ /* union usage   | properties */
  JS_CLASS_OBJECT = 1, /* must be first */
  JS_CLASS_ARRAY, /* u.array       | length */
  JS_CLASS_ERROR,
  JS_CLASS_NUMBER, /* u.object_data */
  JS_CLASS_STRING, /* u.object_data */
  JS_CLASS_BOOLEAN, /* u.object_data */
  JS_CLASS_SYMBOL, /* u.object_data */
  JS_CLASS_ARGUMENTS, /* u.array       | length */
  JS_CLASS_MAPPED_ARGUMENTS, /*               | length */
  JS_CLASS_DATE, /* u.object_data */
  JS_CLASS_MODULE_NS,
  JS_CLASS_C_FUNCTION, /* u.cfunc */
  JS_CLASS_BYTECODE_FUNCTION, /* u.func */
  JS_CLASS_BOUND_FUNCTION, /* u.bound_function */
  JS_CLASS_C_FUNCTION_DATA, /* u.c_function_data_record */
  JS_CLASS_GENERATOR_FUNCTION, /* u.func */
  JS_CLASS_FOR_IN_ITERATOR, /* u.for_in_iterator */
  JS_CLASS_REGEXP, /* u.regexp */
  JS_CLASS_ARRAY_BUFFER, /* u.array_buffer */
  JS_CLASS_SHARED_ARRAY_BUFFER, /* u.array_buffer */
  JS_CLASS_UINT8C_ARRAY, /* u.array (typed_array) */
  JS_CLASS_INT8_ARRAY, /* u.array (typed_array) */
  JS_CLASS_UINT8_ARRAY, /* u.array (typed_array) */
  JS_CLASS_INT16_ARRAY, /* u.array (typed_array) */
  JS_CLASS_UINT16_ARRAY, /* u.array (typed_array) */
  JS_CLASS_INT32_ARRAY, /* u.array (typed_array) */
  JS_CLASS_UINT32_ARRAY, /* u.array (typed_array) */
#ifdef CONFIG_BIGNUM
  JS_CLASS_BIG_INT64_ARRAY, /* u.array (typed_array) */
  JS_CLASS_BIG_UINT64_ARRAY, /* u.array (typed_array) */
#endif
  JS_CLASS_FLOAT16_ARRAY, /* u.array (typed_array) */
  JS_CLASS_FLOAT32_ARRAY, /* u.array (typed_array) */
  JS_CLASS_FLOAT64_ARRAY, /* u.array (typed_array) */
  JS_CLASS_DATAVIEW, /* u.typed_array */
  JS_CLASS_BIG_INT, /* u.object_data */
  JS_CLASS_MAP, /* u.map_state */
  JS_CLASS_SET, /* u.map_state */
  JS_CLASS_WEAKMAP, /* u.map_state */
  JS_CLASS_WEAKSET, /* u.map_state */
  JS_CLASS_MAP_ITERATOR, /* u.map_iterator_data */
  JS_CLASS_SET_ITERATOR, /* u.map_iterator_data */
  JS_CLASS_ARRAY_ITERATOR, /* u.array_iterator_data */
  JS_CLASS_STRING_ITERATOR, /* u.array_iterator_data */
  JS_CLASS_REGEXP_STRING_ITERATOR, /* u.regexp_string_iterator_data */
  JS_CLASS_GENERATOR, /* u.generator_data */
  JS_CLASS_PROXY, /* u.proxy_data */
  JS_CLASS_PROMISE, /* u.promise_data */
  JS_CLASS_PROMISE_RESOLVE_FUNCTION, /* u.promise_function_data */
  JS_CLASS_PROMISE_REJECT_FUNCTION, /* u.promise_function_data */
  JS_CLASS_ASYNC_FUNCTION, /* u.func */
  JS_CLASS_ASYNC_FUNCTION_RESOLVE, /* u.async_function_data */
  JS_CLASS_ASYNC_FUNCTION_REJECT, /* u.async_function_data */
  JS_CLASS_ASYNC_FROM_SYNC_ITERATOR, /* u.async_from_sync_iterator_data */
  JS_CLASS_ASYNC_GENERATOR_FUNCTION, /* u.func */
  JS_CLASS_ASYNC_GENERATOR, /* u.async_generator_data */
  JS_CLASS_WEAK_REF,
  JS_CLASS_FINALIZATION_REGISTRY,

  JS_CLASS_INIT_COUNT, /* last entry for predefined classes */
};

/* number of typed array types */
#define JS_TYPED_ARRAY_COUNT \
  (JS_CLASS_FLOAT64_ARRAY - JS_CLASS_UINT8C_ARRAY + 1)

/* Typed Arrays */

static const uint8_t typed_array_size_log2[JS_TYPED_ARRAY_COUNT] = {
  0,
  0,
  0,
  1,
  1,
  2,
  2,
#ifdef CONFIG_BIGNUM
  3, /* BigInt64Array */
  3, /* BigUint64Array */
#endif
  1, /* Float16Array */
  2, /* Float32Array */
  3  /* Float64Array */
};

#define typed_array_size_log2(classid) \
  (typed_array_size_log2[(classid)-JS_CLASS_UINT8C_ARRAY])

/* the variable and scope indexes must fit on 16 bits. The (-1) and
   ARG_SCOPE_END values are reserved. */
#define JS_MAX_LOCAL_VARS 65534
#define JS_STACK_SIZE_MAX 65534
#define JS_STRING_LEN_MAX ((1 << 30) - 1)

/* strings <= this length are not concatenated using ropes. if too
   small, the rope memory overhead becomes high. */
#define JS_STRING_ROPE_SHORT_LEN  512
/* specific threshold for initial rope use */
#define JS_STRING_ROPE_SHORT2_LEN 8192
/* rope depth at which we rebalance */
#define JS_STRING_ROPE_MAX_DEPTH 60

#define __exception __attribute__((warn_unused_result))

typedef enum {
  JS_GC_PHASE_NONE,
  JS_GC_PHASE_DECREF,
  JS_GC_PHASE_REMOVE_CYCLES,
} JSGCPhaseEnum;

typedef enum OPCodeEnum {
#define FMT(f)
#define DEF(id, size, n_pop, n_push, f) OP_##id,
#define def(id, size, n_pop, n_push, f)
#include "QuickJS/quickjs-opcode.h"
#undef def
#undef DEF
#undef FMT
  OP_COUNT, /* excluding temporary opcodes */
  /* temporary opcodes : overlap with the short opcodes */
  OP_TEMP_START = OP_nop + 1,
  OP___dummy = OP_TEMP_START - 1,
#define FMT(f)
#define DEF(id, size, n_pop, n_push, f)
#define def(id, size, n_pop, n_push, f) OP_##id,
#include "QuickJS/quickjs-opcode.h"
#undef def
#undef DEF
#undef FMT
  OP_TEMP_END,
} OPCodeEnum;

typedef enum {
  JS_RUNTIME_STATE_INIT,
  JS_RUNTIME_STATE_RUNNING,
  JS_RUNTIME_STATE_SHUTDOWN,
} JSRuntimeState;

typedef struct JSDebuggerFunctionInfo {
  // same length as byte_code_buf.
  uint8_t* breakpoints;
  uint32_t dirty;
  int last_line_num;
} JSDebuggerFunctionInfo;

struct JSRuntime {
  JSMallocFunctions mf;
  JSMallocState malloc_state;
  const char* rt_info;

  int atom_hash_size; /* power of two */
  int atom_count;
  int atom_size;
  int atom_count_resize; /* resize hash table at this count */
  uint32_t* atom_hash;
  JSAtomStruct** atom_array;
  int atom_free_index; /* 0 = none */

  int class_count; /* size of class_array */
  JSClass* class_array;

  struct list_head context_list; /* list of JSContext.link */
  /* list of JSGCObjectHeader.link. List of allocated GC objects (used
     by the garbage collector) */
  struct list_head gc_obj_list;
  /* list of JSGCObjectHeader.link. Used during JS_FreeValueRT() */
  struct list_head gc_zero_ref_count_list;
  struct list_head tmp_obj_list; /* used during GC */
  JSGCPhaseEnum gc_phase : 8;
  BOOL gc_off : 8;
  size_t malloc_gc_threshold;
  struct list_head weakref_list; /* list of JSWeakRefHeader.link */
#ifdef DUMP_LEAKS
  struct list_head string_list; /* list of JSString.link */
#endif
  /* stack limitation */
  uintptr_t stack_size; /* in bytes, 0 if no limit */
  uintptr_t stack_top;
  uintptr_t stack_limit; /* lower stack limit */

  JSValue current_exception;
  /* true if the current exception cannot be catched */
  BOOL current_exception_is_uncatchable : 8;
  /* true if inside an out of memory error, to avoid recursing */
  BOOL in_out_of_memory : 8;

  struct JSStackFrame* current_stack_frame;

  JSInterruptHandler* interrupt_handler;
  void* interrupt_opaque;

  JSHostPromiseRejectionTracker* host_promise_rejection_tracker;
  void* host_promise_rejection_tracker_opaque;

  struct list_head job_list; /* list of JSJobEntry.link */

  JSModuleNormalizeFunc* module_normalize_func;
  BOOL module_loader_has_attr;
  union {
      JSModuleLoaderFunc *module_loader_func;
      JSModuleLoaderFunc2 *module_loader_func2;
  } u;
  JSModuleCheckSupportedImportAttributes *module_check_attrs;
  void* module_loader_opaque;
  /* timestamp for internal use in module evaluation */
  int64_t module_async_evaluation_next_timestamp;

  BOOL can_block : 8; /* TRUE if Atomics.wait can block */
  /* used to allocate, free and clone SharedArrayBuffers */
  JSSharedArrayBufferFunctions sab_funcs;
  /* see JS_SetStripInfo() */
  uint8_t strip_flags;

  /* Shape hash table */
  int shape_hash_bits;
  int shape_hash_size;
  int shape_hash_count; /* number of hashed shapes */
  JSShape** shape_hash;
  void* user_opaque;
  JSRuntimeState state; /** @todo diff */
#if QUICKJS_DEBUG
  JSDebuggerInfo debugger_info;
#endif
  JSValueFreeRecall* free_recall_fun;
  void* free_recall_fun_context;
};

struct JSClass {
  uint32_t class_id; /* 0 means free entry */
  JSAtom class_name;
  JSClassFinalizer* finalizer;
  JSClassGCMark* gc_mark;
  JSClassCall* call;
  /* pointers for exotic behavior, can be NULL if none are present */
  const JSClassExoticMethods* exotic;
};

typedef struct JSClassShortDef {
  JSAtom class_name;
  JSClassFinalizer* finalizer;
  JSClassGCMark* gc_mark;
} JSClassShortDef;

typedef enum {
  JS_AUTOINIT_ID_PROTOTYPE,
  JS_AUTOINIT_ID_MODULE_NS,
  JS_AUTOINIT_ID_PROP,
} JSAutoInitIDEnum;

typedef enum JSStrictEqModeEnum {
  JS_EQ_STRICT,
  JS_EQ_SAME_VALUE,
  JS_EQ_SAME_VALUE_ZERO,
} JSStrictEqModeEnum;

/* must be large enough to have a negligible runtime cost and small
   enough to call the interrupt callback often. */
#define JS_INTERRUPT_COUNTER_INIT 10000

typedef union JSFloat64Union {
  double d;
  uint64_t u64;
  uint32_t u32[2];
} JSFloat64Union;

enum {
  JS_ATOM_TYPE_STRING = 1,
  JS_ATOM_TYPE_GLOBAL_SYMBOL,
  JS_ATOM_TYPE_SYMBOL,
  JS_ATOM_TYPE_PRIVATE,
};

typedef enum {
  JS_ATOM_KIND_STRING,
  JS_ATOM_KIND_SYMBOL,
  JS_ATOM_KIND_PRIVATE,
} JSAtomKindEnum;

#define JS_ATOM_HASH_MASK ((1 << 30) - 1)
#define JS_ATOM_HASH_PRIVATE JS_ATOM_HASH_MASK

struct JSString {
  JSRefCountHeader header; /* must come first, 32-bit */
  uint32_t len : 31;
  uint8_t is_wide_char : 1; /* 0 = 8 bits, 1 = 16 bits characters */
  /* for JS_ATOM_TYPE_SYMBOL: hash = weakref_count, atom_type = 3,
      for JS_ATOM_TYPE_PRIVATE: hash = JS_ATOM_HASH_PRIVATE, atom_type = 3
      XXX: could change encoding to have one more bit in hash */
  uint32_t hash : 30;
  uint8_t atom_type : 2; /* != 0 if atom, JS_ATOM_TYPE_x */
  uint32_t hash_next; /* atom_index for JS_ATOM_TYPE_SYMBOL */
#ifdef DUMP_LEAKS
  struct list_head link; /* string list */
#endif
  union {
    uint8_t str8[0]; /* 8 bit strings will get an extra null terminator */
    uint16_t str16[0];
  } u;
};

typedef struct JSStringRope {
    JSRefCountHeader header; /* must come first, 32-bit */
    uint32_t len;
    uint8_t is_wide_char; /* 0 = 8 bits, 1 = 16 bits characters */
    uint8_t depth; /* max depth of the rope tree */
    /* XXX: could reduce memory usage by using a direct pointer with
       bit 0 to select rope or string */
    JSValue left;
    JSValue right; /* might be the empty string */
} JSStringRope;

typedef struct JSClosureVar {
  uint8_t is_local : 1;
  uint8_t is_arg : 1;
  uint8_t is_const : 1;
  uint8_t is_lexical : 1;
  uint8_t var_kind : 4; /* see JSVarKindEnum */
  /* 8 bits available */
  uint16_t var_idx; /* is_local = TRUE: index to a normal variable of the
                  parent function. otherwise: index to a closure
                  variable of the parent function */
  JSAtom var_name;
} JSClosureVar;

#define ARG_SCOPE_INDEX 1
#define ARG_SCOPE_END (-2)
#define DEBUG_SCOP_INDEX (-3)

typedef struct JSVarScope {
  int parent; /* index into fd->scopes of the enclosing scope */
  int first; /* index into fd->vars of the last variable in this scope */
} JSVarScope;

typedef enum {
  /* XXX: add more variable kinds here instead of using bit fields */
  JS_VAR_NORMAL,
  JS_VAR_FUNCTION_DECL, /* lexical var with function declaration */
  JS_VAR_NEW_FUNCTION_DECL, /* lexical var with async/generator
                               function declaration */
  JS_VAR_CATCH,
  JS_VAR_FUNCTION_NAME, /* function expression name */
  JS_VAR_PRIVATE_FIELD,
  JS_VAR_PRIVATE_METHOD,
  JS_VAR_PRIVATE_GETTER,
  JS_VAR_PRIVATE_SETTER, /* must come after JS_VAR_PRIVATE_GETTER */
  JS_VAR_PRIVATE_GETTER_SETTER, /* must come after JS_VAR_PRIVATE_SETTER */
} JSVarKindEnum;

/* XXX: could use a different structure in bytecode functions to save
   memory */
typedef struct JSVarDef {
  JSAtom var_name;
  /* index into fd->scopes of this variable lexical scope */
  int scope_level;
  /* during compilation:
      - if scope_level = 0: scope in which the variable is defined
      - if scope_level != 0: index into fd->vars of the next
        variable in the same or enclosing lexical scope
     in a bytecode function:
     index into fd->vars of the next
     variable in the same or enclosing lexical scope
  */
  int scope_next;
  uint8_t is_const : 1;
  uint8_t is_lexical : 1;
  uint8_t is_captured : 1;
  uint8_t
      is_static_private : 1; /* only used during private class field parsing */
  uint8_t var_kind : 4; /* see JSVarKindEnum */
  /* only used during compilation: function pool index for lexical
     variables with var_kind =
     JS_VAR_FUNCTION_DECL/JS_VAR_NEW_FUNCTION_DECL or scope level of
     the definition of the 'var' variables (they have scope_level =
     0) */
  int func_pool_idx : 24; /* only used during compilation : index in
                             the constant pool for hoisted function
                             definition */
} JSVarDef;

#define IC_CACHE_ITEM_CAPACITY 4

typedef int watchpoint_delete_callback(
    JSRuntime* rt,
    intptr_t ref,
    JSAtom atom,
    void* target);
typedef int watchpoint_free_callback(JSRuntime* rt, intptr_t ref, JSAtom atom);

typedef struct ICWatchpoint {
  intptr_t ref;
  JSAtom atom;
  watchpoint_delete_callback* delete_callback;
  watchpoint_free_callback* free_callback;
  struct list_head link;
} ICWatchpoint;

typedef struct InlineCacheRingItem {
  JSObject* proto;
  JSShape* shape;
  uint32_t prop_offset;
  ICWatchpoint* watchpoint_ref;
} InlineCacheRingItem;

typedef struct InlineCacheRingSlot {
  JSAtom atom;
  InlineCacheRingItem buffer[IC_CACHE_ITEM_CAPACITY];
  uint8_t index;
} InlineCacheRingSlot;

typedef struct InlineCacheHashSlot {
  JSAtom atom;
  uint32_t index;
  struct InlineCacheHashSlot* next;
} InlineCacheHashSlot;

typedef struct InlineCache {
  uint32_t count;
  uint32_t capacity;
  uint32_t hash_bits;
  JSContext* ctx;
  InlineCacheHashSlot** hash;
  InlineCacheRingSlot* cache;
  uint32_t updated_offset;
  BOOL updated;
} InlineCache;

typedef struct JSFunctionBytecode {
  JSGCObjectHeader header; /* must come first */
  uint8_t js_mode;
  uint8_t has_prototype : 1; /* true if a prototype field is necessary */
  uint8_t has_simple_parameter_list : 1;
  uint8_t is_derived_class_constructor : 1;
  /* true if home_object needs to be initialized */
  uint8_t need_home_object : 1;
  uint8_t func_kind : 2;
  uint8_t new_target_allowed : 1;
  uint8_t super_call_allowed : 1;
  uint8_t super_allowed : 1;
  uint8_t arguments_allowed : 1;
  uint8_t has_debug : 1;
  uint8_t read_only_bytecode : 1;
  uint8_t
      is_direct_or_indirect_eval : 1; /* used by JS_GetScriptOrModuleName() */
  /* XXX: 10 bits available */
  uint8_t* byte_code_buf; /* (self pointer) */
  int byte_code_len;
  JSAtom func_name;
  JSVarDef* vardefs; /* arguments + local variables (arg_count + var_count)
                        (self pointer) */
  JSClosureVar*
      closure_var; /* list of variables in the closure (self pointer) */
  uint16_t arg_count;
  uint16_t var_count;
  uint16_t defined_arg_count; /* for length function property */
  uint16_t stack_size; /* maximum stack size */
  JSContext* realm; /* function realm */
  JSValue* cpool; /* constant pool (self pointer) */
  int cpool_count;
  int closure_var_count;
  InlineCache* ic;
  struct {
    /* debug info, move to separate structure to save memory? */
    JSAtom filename;
    int source_len;
    int pc2line_len;
    int pc2column_len;
    uint8_t* pc2line_buf;
    uint8_t* pc2column_buf;
    char* source;
  } debug;
#if QUICKJS_DEBUG
  struct JSDebuggerFunctionInfo debugger;
#endif
} JSFunctionBytecode;

typedef struct JSBoundFunction {
  JSValue func_obj;
  JSValue this_val;
  int argc;
  JSValue argv[0];
} JSBoundFunction;

typedef enum JSIteratorKindEnum {
  JS_ITERATOR_KIND_KEY,
  JS_ITERATOR_KIND_VALUE,
  JS_ITERATOR_KIND_KEY_AND_VALUE,
} JSIteratorKindEnum;

typedef struct JSForInIterator {
  JSValue obj;
  uint32_t idx;
  uint32_t atom_count;
  uint8_t in_prototype_chain;
  uint8_t is_array;
  JSPropertyEnum* tab_atom; /* is_array = FALSE */
} JSForInIterator;

typedef struct JSRegExp {
  JSString* pattern;
  JSString* bytecode; /* also contains the flags */
} JSRegExp;

typedef struct JSProxyData {
  JSValue target;
  JSValue handler;
  uint8_t is_func;
  uint8_t is_revoked;
} JSProxyData;

typedef struct JSStarExportEntry {
  int req_module_idx; /* in req_module_entries */
} JSStarExportEntry;

typedef struct JSReqModuleEntry {
  JSAtom module_name;
  JSModuleDef* module; /* used using resolution */
  JSValue attributes; /* JS_UNDEFINED or an object contains the attributes as key/value */
} JSReqModuleEntry;

typedef struct JSStackFrame {
  struct JSStackFrame* prev_frame; /* NULL if first stack frame */
  JSValue
      cur_func; /* current function, JS_UNDEFINED if the frame is detached */
  JSValue* arg_buf; /* arguments */
  JSValue* var_buf; /* variables */
  struct list_head var_ref_list; /* list of JSVarRef.link */
  uint8_t* cur_pc; /* only used in bytecode functions : PC of the
                      instruction after the call */
  int arg_count;
  int js_mode; /* not supported for C functions */
  /* only used in generators. Current stack pointer value. NULL if
     the function is running. */
  JSValue* cur_sp;
} JSStackFrame;

typedef struct JSArrayBuffer {
  int byte_length; /* 0 if detached */
  uint8_t detached;
  uint8_t shared; /* if shared, the array buffer cannot be detached */
  uint8_t* data; /* NULL if detached */
  struct list_head array_list;
  void* opaque;
  JSFreeArrayBufferDataFunc* free_func;
} JSArrayBuffer;

typedef struct JSTypedArray {
  struct list_head link; /* link to arraybuffer */
  JSObject* obj; /* back pointer to the TypedArray/DataView object */
  JSObject* buffer; /* based array buffer */
  uint32_t offset; /* offset in the array buffer */
  uint32_t length; /* length in the array buffer */
} JSTypedArray;

typedef struct JSAsyncFunctionState {
  JSGCObjectHeader header;
  JSValue this_val; /* 'this' argument */
  int argc; /* number of function arguments */
  JS_BOOL throw_flag; /* used to throw an exception in JS_CallInternal() */
  JS_BOOL is_completed; /* TRUE if the function has returned. The stack
                        frame is no longer valid */
  JSValue resolving_funcs[2]; /* only used in JS async functions */
  JSStackFrame frame;
} JSAsyncFunctionState;

/* XXX: could use an object instead to avoid the
   JS_TAG_ASYNC_FUNCTION tag for the GC */
typedef struct JSAsyncFunctionData {
  JSGCObjectHeader header; /* must come first */
  JSValue resolving_funcs[2];
  BOOL is_active; /* true if the async function state is valid */
  JSAsyncFunctionState func_state;
} JSAsyncFunctionData;

typedef enum {
  /* binary operators */
  JS_OVOP_ADD,
  JS_OVOP_SUB,
  JS_OVOP_MUL,
  JS_OVOP_DIV,
  JS_OVOP_MOD,
  JS_OVOP_POW,
  JS_OVOP_OR,
  JS_OVOP_AND,
  JS_OVOP_XOR,
  JS_OVOP_SHL,
  JS_OVOP_SAR,
  JS_OVOP_SHR,
  JS_OVOP_EQ,
  JS_OVOP_LESS,

  JS_OVOP_BINARY_COUNT,
  /* unary operators */
  JS_OVOP_POS = JS_OVOP_BINARY_COUNT,
  JS_OVOP_NEG,
  JS_OVOP_INC,
  JS_OVOP_DEC,
  JS_OVOP_NOT,

  JS_OVOP_COUNT,
} JSOverloadableOperatorEnum;

typedef struct {
  uint32_t operator_index;
  JSObject* ops[JS_OVOP_BINARY_COUNT]; /* self operators */
} JSBinaryOperatorDefEntry;

typedef struct {
  int count;
  JSBinaryOperatorDefEntry* tab;
} JSBinaryOperatorDef;

typedef struct {
  uint32_t operator_counter;
  BOOL is_primitive; /* OperatorSet for a primitive type */
  /* NULL if no operator is defined */
  JSObject* self_ops[JS_OVOP_COUNT]; /* self operators */
  JSBinaryOperatorDef left;
  JSBinaryOperatorDef right;
} JSOperatorSetData;

typedef struct JSVarRef {
  union {
    JSGCObjectHeader header; /* must come first */
    struct {
      int __gc_ref_count; /* corresponds to header.ref_count */
      uint8_t __gc_mark; /* corresponds to header.mark/gc_obj_type */

      /* 0 : the JSVarRef is on the stack. header.link is an element
         of JSStackFrame.var_ref_list.
         1 : the JSVarRef is detached. header.link has the normal meanning
      */
      uint8_t is_detached;
    };
  };
  JSValue* pvalue; /* pointer to the value, either on the stack or
                      to 'value' */
  union {
    JSValue value; /* used when is_detached = TRUE */
    struct {
      struct list_head var_ref_link; /* JSStackFrame.var_ref_list list */
      struct JSAsyncFunctionState*
          async_func; /* != NULL if async stack frame */
    }; /* used when is_detached = FALSE */
  };
} JSVarRef;

/* bigint */

#if JS_LIMB_BITS == 32

typedef int32_t js_slimb_t;
typedef uint32_t js_limb_t;
typedef int64_t js_sdlimb_t;
typedef uint64_t js_dlimb_t;

#define JS_LIMB_DIGITS 9

#else

typedef __int128 int128_t;
typedef unsigned __int128 uint128_t;
typedef int64_t js_slimb_t;
typedef uint64_t js_limb_t;
typedef int128_t js_sdlimb_t;
typedef uint128_t js_dlimb_t;

#define JS_LIMB_DIGITS 19

#endif

typedef struct JSBigInt {
    JSRefCountHeader header; /* must come first, 32-bit */
    uint32_t len; /* number of limbs, >= 1 */
    js_limb_t tab[]; /* two's complement representation, always
                        normalized so that 'len' is the minimum
                        possible length >= 1 */
} JSBigInt;

/* this bigint structure can hold a 64 bit integer */
typedef struct {
    js_limb_t big_int_buf[sizeof(JSBigInt) / sizeof(js_limb_t)]; /* for JSBigInt */
    /* must come just after */
    js_limb_t tab[(64 + JS_LIMB_BITS - 1) / JS_LIMB_BITS];
} JSBigIntBuf;

typedef struct JSImportEntry {
  int var_idx; /* closure variable index */
  BOOL is_star; /* import_name = '*' is a valid import name, so need a flag */
  JSAtom import_name;
  int req_module_idx; /* in req_module_entries */
} JSImportEntry;

typedef enum JSExportTypeEnum {
  JS_EXPORT_TYPE_LOCAL,
  JS_EXPORT_TYPE_INDIRECT,
} JSExportTypeEnum;

typedef struct JSExportEntry {
  union {
    struct {
      int var_idx; /* closure variable index */
      JSVarRef* var_ref; /* if != NULL, reference to the variable */
    } local; /* for local export */
    int req_module_idx; /* module for indirect export */
  } u;
  JSExportTypeEnum export_type;
  JSAtom local_name; /* '*' if export ns from. not used for local
                        export after compilation */
  JSAtom export_name; /* exported variable name */
} JSExportEntry;

typedef enum {
  JS_MODULE_STATUS_UNLINKED,
  JS_MODULE_STATUS_LINKING,
  JS_MODULE_STATUS_LINKED,
  JS_MODULE_STATUS_EVALUATING,
  JS_MODULE_STATUS_EVALUATING_ASYNC,
  JS_MODULE_STATUS_EVALUATED,
} JSModuleStatus;

struct JSModuleDef {
  JSGCObjectHeader header; /* must come first */
  JSAtom module_name;
  struct list_head link;

  JSReqModuleEntry* req_module_entries;
  int req_module_entries_count;
  int req_module_entries_size;

  JSExportEntry* export_entries;
  int export_entries_count;
  int export_entries_size;

  JSStarExportEntry* star_export_entries;
  int star_export_entries_count;
  int star_export_entries_size;

  JSImportEntry* import_entries;
  int import_entries_count;
  int import_entries_size;

  JSValue module_ns;
  JSValue func_obj; /* only used for JS modules */
  JSModuleInitFunc* init_func; /* only used for C modules */
  JSModuleInitDataFunc* init_data_func; /* only used for C modules */
  JS_BOOL has_tla : 8; /* true if func_obj contains await */
  JS_BOOL resolved : 8;
  JS_BOOL func_created : 8;
  JSModuleStatus status : 8;
  /* temp use during js_module_link() & js_module_evaluate() */
  int dfs_index, dfs_ancestor_index;
  JSModuleDef* stack_prev;
  /* temp use during js_module_evaluate() */
  JSModuleDef** async_parent_modules;
  int async_parent_modules_count;
  int async_parent_modules_size;
  int pending_async_dependencies;
  BOOL async_evaluation; /* true: async_evaluation_timestamp corresponds to [[AsyncEvaluationOrder]] 
                            false: [[AsyncEvaluationOrder]] is UNSET or DONE */
  int64_t async_evaluation_timestamp;
  JSModuleDef* cycle_root;
  JS_BOOL instantiated : 8;
  JS_BOOL evaluated : 8;
  JS_BOOL eval_mark : 8; /* temporary use during js_evaluate_module() */
  JSValue promise; /* corresponds to spec field: capability */
  JSValue resolving_funcs[2]; /* corresponds to spec field: capability */

  /* true if evaluation yielded an exception. It is saved in
     eval_exception */
  JS_BOOL eval_has_exception : 8;
  JSValue eval_exception;
  JSValue meta_obj; /* for import.meta */
  JSValue private_value; /* private value for C modules */

  void* init_data_opaque;
};

typedef struct JSJobEntry {
  struct list_head link;
  JSContext *realm;
  JSJobFunc* job_func;
  int argc;
  JSValue argv[0];
} JSJobEntry;

typedef struct JSProperty {
  union {
    JSValue value; /* JS_PROP_NORMAL */
    struct { /* JS_PROP_GETSET */
      JSObject* getter; /* NULL if undefined */
      JSObject* setter; /* NULL if undefined */
    } getset;
    JSVarRef* var_ref; /* JS_PROP_VARREF */
    struct { /* JS_PROP_AUTOINIT */
      /* in order to use only 2 pointers, we compress the realm
         and the init function pointer */
      uintptr_t realm_and_id; /* realm and init_id (JS_AUTOINIT_ID_x)
                                 in the 2 low bits */
      void* opaque;
    } init;
  } u;
} JSProperty;

#ifdef ENABLE_MEMORY_INTENSIVE_MODE
#define JS_PROP_INITIAL_SIZE 6
#define JS_PROP_INITIAL_HASH_SIZE 24 /* must be a power of two */
#define ATOM_HASH_INITIAL_SIZE 1024
#define ATOM_HASH_EXPANSION_MIN 1066
#define BUFFER_EXPANSION_FACTOR 9 / 2
#define MALLOC_GC_THRESHOLD 64 * 1024 * 1024 /* 64 MB as a start */
#else
#define JS_PROP_INITIAL_SIZE 2
#define JS_PROP_INITIAL_HASH_SIZE 4 /* must be a power of two */
#define ATOM_HASH_INITIAL_SIZE 256
#define ATOM_HASH_EXPANSION_MIN 211
#define BUFFER_EXPANSION_FACTOR 3 / 2
#define MALLOC_GC_THRESHOLD 256 * 1024 /* 256 KB as a start */
#endif
#define JS_ARRAY_INITIAL_SIZE 2

struct JSObject {
  union {
    JSGCObjectHeader header;
    struct {
      int __gc_ref_count; /* corresponds to header.ref_count */
      uint8_t __gc_mark; /* corresponds to header.mark/gc_obj_type */

      uint8_t extensible : 1;
      uint8_t free_mark : 1; /* only used when freeing objects with cycles */
      uint8_t is_exotic : 1; /* TRUE if object has exotic property handlers */
      uint8_t fast_array : 1; /* TRUE if u.array is used for get/put (for
                                 JS_CLASS_ARRAY, JS_CLASS_ARGUMENTS and typed
                                 arrays) */
      uint8_t is_constructor : 1; /* TRUE if object is a constructor function */
      uint8_t has_immutable_prototype : 1; /* cannot modify the prototype */
      uint8_t tmp_mark : 1; /* used in JS_WriteObjectRec() */
      uint8_t is_HTMLDDA : 1; /* specific annex B IsHtmlDDA behavior */
      uint16_t class_id; /* see JS_CLASS_x */
    };
  };
  /* count the number of weak references to this object. The object
      structure is freed only if header.ref_count = 0 and
      weakref_count = 0 */
  uint32_t weakref_count; 
  JSShape* shape; /* prototype and property names + flag */
  JSProperty* prop; /* array of properties */
  union {
    void* opaque;
    struct JSBoundFunction* bound_function; /* JS_CLASS_BOUND_FUNCTION */
    struct JSCFunctionDataRecord*
        c_function_data_record; /* JS_CLASS_C_FUNCTION_DATA */
    struct JSForInIterator* for_in_iterator; /* JS_CLASS_FOR_IN_ITERATOR */
    struct JSArrayBuffer*
        array_buffer; /* JS_CLASS_ARRAY_BUFFER, JS_CLASS_SHARED_ARRAY_BUFFER */
    struct JSTypedArray*
        typed_array; /* JS_CLASS_UINT8C_ARRAY..JS_CLASS_DATAVIEW */
    struct JSMapState* map_state; /* JS_CLASS_MAP..JS_CLASS_WEAKSET */
    struct JSMapIteratorData*
        map_iterator_data; /* JS_CLASS_MAP_ITERATOR, JS_CLASS_SET_ITERATOR */
    struct JSArrayIteratorData*
        array_iterator_data; /* JS_CLASS_ARRAY_ITERATOR,
                                JS_CLASS_STRING_ITERATOR */
    struct JSRegExpStringIteratorData*
        regexp_string_iterator_data; /* JS_CLASS_REGEXP_STRING_ITERATOR */
    struct JSGeneratorData* generator_data; /* JS_CLASS_GENERATOR */
    struct JSProxyData* proxy_data; /* JS_CLASS_PROXY */
    struct JSPromiseData* promise_data; /* JS_CLASS_PROMISE */
    struct JSPromiseFunctionData*
        promise_function_data; /* JS_CLASS_PROMISE_RESOLVE_FUNCTION,
                                  JS_CLASS_PROMISE_REJECT_FUNCTION */
    struct JSAsyncFunctionState*
        async_function_data; /* JS_CLASS_ASYNC_FUNCTION_RESOLVE,
                                JS_CLASS_ASYNC_FUNCTION_REJECT */
    struct JSAsyncFromSyncIteratorData*
        async_from_sync_iterator_data; /* JS_CLASS_ASYNC_FROM_SYNC_ITERATOR */
    struct JSAsyncGeneratorData*
        async_generator_data; /* JS_CLASS_ASYNC_GENERATOR */
    struct { /* JS_CLASS_BYTECODE_FUNCTION: 12/24 bytes */
      /* also used by JS_CLASS_GENERATOR_FUNCTION, JS_CLASS_ASYNC_FUNCTION and
       * JS_CLASS_ASYNC_GENERATOR_FUNCTION */
      struct JSFunctionBytecode* function_bytecode;
      JSVarRef** var_refs;
      JSObject* home_object; /* for 'super' access */
    } func;
    struct { /* JS_CLASS_C_FUNCTION: 12/20 bytes */
      JSContext* realm;
      JSCFunctionType c_function;
      uint8_t length;
      uint8_t cproto;
      int16_t magic;
    } cfunc;
    /* array part for fast arrays and typed arrays */
    struct { /* JS_CLASS_ARRAY, JS_CLASS_ARGUMENTS,
                JS_CLASS_UINT8C_ARRAY..JS_CLASS_FLOAT64_ARRAY */
      union {
        uint32_t size; /* JS_CLASS_ARRAY, JS_CLASS_ARGUMENTS */
        struct JSTypedArray*
            typed_array; /* JS_CLASS_UINT8C_ARRAY..JS_CLASS_FLOAT64_ARRAY */
      } u1;
      union {
        JSValue* values; /* JS_CLASS_ARRAY, JS_CLASS_ARGUMENTS */
        void* ptr; /* JS_CLASS_UINT8C_ARRAY..JS_CLASS_FLOAT64_ARRAY */
        int8_t* int8_ptr; /* JS_CLASS_INT8_ARRAY */
        uint8_t* uint8_ptr; /* JS_CLASS_UINT8_ARRAY, JS_CLASS_UINT8C_ARRAY */
        int16_t* int16_ptr; /* JS_CLASS_INT16_ARRAY */
        uint16_t* uint16_ptr; /* JS_CLASS_UINT16_ARRAY */
        int32_t* int32_ptr; /* JS_CLASS_INT32_ARRAY */
        uint32_t* uint32_ptr; /* JS_CLASS_UINT32_ARRAY */
        int64_t* int64_ptr; /* JS_CLASS_INT64_ARRAY */
        uint64_t* uint64_ptr; /* JS_CLASS_UINT64_ARRAY */
        uint16_t *fp16_ptr;     /* JS_CLASS_FLOAT16_ARRAY */
        float* float_ptr; /* JS_CLASS_FLOAT32_ARRAY */
        double* double_ptr; /* JS_CLASS_FLOAT64_ARRAY */
      } u;
      uint32_t count; /* <= 2^31-1. 0 for a detached typed array */
    } array; /* 12/20 bytes */
    JSRegExp regexp; /* JS_CLASS_REGEXP: 8/16 bytes */
    JSValue object_data; /* for JS_SetObjectData(): 8/16/16 bytes */
  } u;
  uint8_t free_recall;
};

typedef struct JSMapRecord {
    int ref_count; /* used during enumeration to avoid freeing the record */
    BOOL empty : 8; /* TRUE if the record is deleted */
    struct list_head link;
    struct JSMapRecord *hash_next;
    JSValue key;
    JSValue value;
} JSMapRecord;

typedef struct JSMapState {
    BOOL is_weak; /* TRUE if WeakSet/WeakMap */
    struct list_head records; /* list of JSMapRecord.link */
    uint32_t record_count;
    JSMapRecord **hash_table;
    int hash_bits;
    uint32_t hash_size; /* = 2 ^ hash_bits */
    uint32_t record_count_threshold; /* count at which a hash table
                                        resize is needed */
    JSWeakRefHeader weakref_header; /* only used if is_weak = TRUE */
} JSMapState;

typedef enum OPCodeFormat {
#define FMT(f) OP_FMT_##f,
#define DEF(id, size, n_pop, n_push, f)
#include "QuickJS/quickjs-opcode.h"
#undef DEF
#undef FMT
} OPCodeFormat;

#define ATOD_INT_ONLY (1 << 0)
/* accept Oo and Ob prefixes in addition to 0x prefix if radix = 0 */
#define ATOD_ACCEPT_BIN_OCT (1 << 2)
/* accept O prefix as octal if radix == 0 and properly formed (Annex B) */
#define ATOD_ACCEPT_LEGACY_OCTAL (1 << 4)
/* accept _ between digits as a digit separator */
#define ATOD_ACCEPT_UNDERSCORES (1 << 5)
/* allow a suffix to override the type */
#define ATOD_ACCEPT_SUFFIX (1 << 6)
/* default type */
#define ATOD_TYPE_MASK (3 << 7)
#define ATOD_TYPE_FLOAT64 (0 << 7)
#define ATOD_TYPE_BIG_INT (1 << 7)
/* accept -0x1 */
#define ATOD_ACCEPT_PREFIX_AFTER_SIGN (1 << 10)
