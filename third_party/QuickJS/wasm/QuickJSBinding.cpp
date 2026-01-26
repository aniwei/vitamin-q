#include <emscripten.h>
#include <string>
#include <stdexcept>
#include "QuickJS/extension/taro_js_bytecode.h"
#include "QuickJS/extension/taro_js_types.h"
#include "QuickJSBinding.h"
#include "../src/core/types.h"
#include "../src/core/builtins/js-function.h"
#include "../src/core/function.h"

namespace quickjs {
  std::string getException(JSContext *context, JSValue module) {
    JSValue exception = JS_GetException(context);
    JSValue message = JS_GetPropertyStr(context, exception, "message");
    JSValue stack = JS_GetPropertyStr(context, exception, "stack");

    const char* messageStr = JS_ToCString(context, message);
    const char* stackStr = JS_ToCString(context, stack);

    std::string ss = std::string(messageStr) + "\n" + std::string(stackStr);

    JS_FreeCString(context, messageStr);
    JS_FreeCString(context, stackStr);
    JS_FreeValue(context, message);
    JS_FreeValue(context, stack);
    JS_FreeValue(context, exception);

    return ss;
  }

  /// @brief
  QuickJSBinding::QuickJSBinding() {}

  JSModuleDef *QuickJSBinding::resolve(
    JSContext *jsContext,
    const char *moduleName,
    void *opaque
  ) {
    auto defaultExport = [](JSContext *jsContext, JSModuleDef *m) {
      return 0;
    };

    JSModuleDef *m = taro_js_new_c_module(jsContext, moduleName, defaultExport);
    return m;
  }

  JSContext *QuickJSBinding::prepare(std::vector<std::string> modules) {
    JSRuntime *runtime = JS_NewRuntime();
    JSContext *context = JS_NewContext(runtime);

    auto defaultExport = [](
      JSContext *context, 
      JSModuleDef *m) { 
        return 0; 
      };

    JS_SetModuleLoaderFunc(
      runtime, 
      nullptr, 
      QuickJSBinding::resolve, 
      nullptr);

    for (const auto &module : modules) {
      JSModuleDef *m = taro_js_new_c_module(
        context, 
        module.c_str(), 
        defaultExport);

      if (!m) {
        throw std::runtime_error("Failed to create module: " + module);
      }
    }

    return context;
  }

  /// @brief Compile as module (default)
  std::vector<uint8_t> QuickJSBinding::compile(
    std::string input, 
    std::string sourceURL,
    std::vector<std::string> modules
  ) {
    return compileWithFlags(input, sourceURL, modules, JS_EVAL_FLAG_COMPILE_ONLY | JS_EVAL_TYPE_MODULE);
  }

  /// @brief Compile as script (global eval)
  std::vector<uint8_t> QuickJSBinding::compileScript(
    std::string input, 
    std::string sourceURL,
    std::vector<std::string> modules
  ) {
    return compileWithFlags(input, sourceURL, modules, JS_EVAL_FLAG_COMPILE_ONLY | JS_EVAL_TYPE_GLOBAL);
  }

  /// @brief Internal compile with flags
  std::vector<uint8_t> QuickJSBinding::compileWithFlags(
    std::string input, 
    std::string sourceURL,
    std::vector<std::string> modules,
    int evalFlags
  ) {
    JSContext *context = prepare(modules);
    JSValue m = JS_Eval(
      context,
      input.c_str(),
      input.size(),
      sourceURL.c_str(),
      evalFlags
    );

    if (taro_is_exception(m)) {
      auto exception = getException(context, m);
      JS_FreeValue(context, m);
      throw std::runtime_error("Failed to compile module detail: " + exception);
    }

    size_t byteLength = 0;
    uint8_t *bytes = JS_WriteObject(
      context,
      &byteLength,
      m,
      JS_WRITE_OBJ_BYTECODE);

    JS_FreeValue(context, m);

    JSRuntime *rt = JS_GetRuntime(context);
    if (!bytes) {
      JS_FreeContext(context);
      JS_FreeRuntime(rt);
      throw std::runtime_error("Failed to write bytecode");
    }

    std::vector<uint8_t> out(bytes, bytes + byteLength);
    js_free(context, bytes);
    JS_FreeContext(context);
    JS_FreeRuntime(rt);

    return out;
  }

  std::string QuickJSBinding::dumpWithBinary(
    std::vector<uint8_t> bytes,
    std::vector<std::string> modules
  ) {
    std::string out;
    
#ifdef DUMP_BYTECODE
    out = taro_js_dump_function_bytecode_bin(bytes.data(), bytes.size());
#endif
    return out;
  }

  std::string QuickJSBinding::runWithBinary(
    std::vector<uint8_t> bytes, 
    std::vector<std::string> modules
  ) {
    JSContext* ctx = prepare(modules);
    JSRuntime* rt = JS_GetRuntime(ctx);

    JSValue obj = JS_ReadObject(
      ctx, 
      bytes.data(), 
      bytes.size(), 
      JS_READ_OBJ_BYTECODE);

    if (taro_is_exception(obj)) {
      std::string err = getException(ctx, obj);
      JS_FreeContext(ctx);
      JS_FreeRuntime(rt);
      return std::string("ERROR: Failed to read bytecode: ") + err;
    }

    // Evaluate module or function
    if (JS_VALUE_GET_TAG(obj) == JS_TAG_MODULE) {
      // For modules, JS_EvalFunction loads the module and returns the evaluation result
      JSValue result = JS_EvalFunction(ctx, obj);
      if (taro_is_exception(result)) {
        std::string err = getException(ctx, result);
        JS_FreeValue(ctx, result);
        JS_FreeContext(ctx);
        JS_FreeRuntime(rt);

        return std::string("ERROR: Failed to eval module: ") + err;
      }

      // Convert result to string (often undefined for modules)
      const char* s = JS_ToCString(ctx, result);
      std::string out = s ? std::string(s) : std::string();

      if (s) JS_FreeCString(ctx, s);
      JS_FreeValue(ctx, result);
      JS_FreeContext(ctx);
      JS_FreeRuntime(rt);
      return out;
    }

    // If function bytecode, create function object and call it
    if (JS_VALUE_GET_TAG(obj) == JS_TAG_FUNCTION_BYTECODE) {
      JSValue func = JS_EvalFunction(ctx, obj);

      if (taro_is_exception(func)) {
        std::string err = getException(ctx, func);
        JS_FreeValue(ctx, func);
        JS_FreeContext(ctx);
        JS_FreeRuntime(rt);
        return std::string("ERROR: Failed to create function from bytecode: ") + err;
      }

      JSValue thisVal = JS_UNDEFINED;
      JSValue ret = JS_Call(ctx, func, thisVal, 0, nullptr);

      if (taro_is_exception(ret)) {
        std::string err = getException(ctx, ret);
        JS_FreeValue(ctx, func);
        JS_FreeValue(ctx, ret);
        JS_FreeContext(ctx);
        JS_FreeRuntime(rt);

        return std::string("ERROR: Runtime exception: ") + err;
      }

      const char* s = JS_ToCString(ctx, ret);
      std::string out = s ? std::string(s) : std::string();

      if (s) JS_FreeCString(ctx, s);

      JS_FreeValue(ctx, func);
      JS_FreeValue(ctx, ret);
      JS_FreeContext(ctx);
      JS_FreeRuntime(rt);

      return out;
    }

    // Fallback: try to eval as general object
    JSValue result = JS_EvalFunction(ctx, obj);
    if (taro_is_exception(result)) {
      std::string err = getException(ctx, result);
      JS_FreeValue(ctx, result);
      JS_FreeContext(ctx);
      JS_FreeRuntime(rt);

      return std::string("ERROR: Failed to eval object: ") + err;
    }
    const char* s = JS_ToCString(ctx, result);
    std::string out = s ? std::string(s) : std::string();
    
    if (s) JS_FreeCString(ctx, s);
    JS_FreeValue(ctx, result);
    JS_FreeContext(ctx);
    JS_FreeRuntime(rt);
    return out;
  }

  uint32_t QuickJSBinding::getBytecodeVersion() {
    return static_cast<uint32_t>(taro_bc_get_version());
  }

  uint32_t QuickJSBinding::getCompileOptions() {
    uint32_t flags = COMPILE_FLAG_NONE;
#ifdef DUMP_BYTECODE
    flags |= COMPILE_FLAG_DUMP;
#endif

#ifdef CONFIG_BIGNUM
    flags |= COMPILE_FLAG_BIGNUM;
#endif

#ifdef SHORT_OPCODES
    flags |= COMPILE_FLAG_SHORT_OPCODES;
#endif
    
    return flags;
  }

  std::vector<Atom> QuickJSBinding::getAtoms() {
    std::vector<Atom> atoms;

    // 同时输出标识符形式(#name)和字符串字面量形式(str)
    #define DEF(name, str) \
      atoms.push_back(Atom{ static_cast<uint32_t>(JS_ATOM_##name), #name }); \
      atoms.push_back(Atom{ static_cast<uint32_t>(JS_ATOM_##name), str });
    #include "QuickJS/quickjs-atom.h"
    #undef DEF

    // 友好别名：空字符串
    atoms.push_back(Atom{ static_cast<uint32_t>(JS_ATOM_empty_string), "empty_string" });
    // 兼容别名：历史映射中使用过的私有品牌占位
    atoms.push_back(Atom{ static_cast<uint32_t>(JS_ATOM_Private_brand), "<private_brand>" });

    return atoms;
  }

  std::vector<Atom> QuickJSBinding::getEnvironmentAtoms() {
    std::vector<Atom> atoms;
    JSRuntime *rt = JS_NewRuntime();
    if (!rt) return atoms;
    JSContext *ctx = JS_NewContext(rt);
    if (!ctx) {
      JS_FreeRuntime(rt);
      return atoms;
    }

    uint32_t count = JS_GetRuntimeAtomCount(rt);
    for (uint32_t i = JS_ATOM_END; i < count; i++) {
      const char *str = JS_AtomToCString(ctx, i);
      if (str) {
        atoms.push_back(Atom{ i, str });
        JS_FreeCString(ctx, str);
      }
    }

    JS_FreeContext(ctx);
    JS_FreeRuntime(rt);
    return atoms;
  }

  uint32_t QuickJSBinding::getFirstAtomId() {
    return JS_ATOM_END;
  }

  uint32_t QuickJSBinding::getGlobalVarOffset() {
    return GLOBAL_VAR_OFFSET;
  }

  uint32_t QuickJSBinding::getArgumentVarOffset() {
    return ARGUMENT_VAR_OFFSET;
  }

  int32_t QuickJSBinding::getArgScopeIndex() {
    return ARG_SCOPE_INDEX;
  }

  int32_t QuickJSBinding::getArgScopeEnd() {
    return ARG_SCOPE_END;
  }

  int32_t QuickJSBinding::getDebugScopeIndex() {
    return DEBUG_SCOP_INDEX;
  }

  int32_t QuickJSBinding::getMaxLocalVars() {
    return JS_MAX_LOCAL_VARS;
  }

  int32_t QuickJSBinding::getStackSizeMax() {
    return JS_STACK_SIZE_MAX;
  }

  std::vector<JSMode> QuickJSBinding::getJSModes() {
    std::vector<JSMode> modes;

    modes.push_back(JSMode{ id: JS_MODE_STRICT, name: "JS_MODE_STRICT" });
    modes.push_back(JSMode{ id: JS_MODE_ASYNC, name: "JS_MODE_ASYNC" });
    modes.push_back(JSMode{ id: JS_MODE_BACKTRACE_BARRIER, name: "JS_MODE_BACKTRACE_BARRIER" });

    return modes;
  }

  std::vector<PC2Line> QuickJSBinding::getPC2LineCodes() {
    std::vector<PC2Line> codes;

    codes.push_back(PC2Line{ id: PC2LINE_BASE, name: "PC2LINE_BASE" });
    codes.push_back(PC2Line{ id: PC2LINE_RANGE, name: "PC2LINE_RANGE" });
    codes.push_back(PC2Line{ id: PC2LINE_OP_FIRST, name: "PC2LINE_OP_FIRST" });
    codes.push_back(PC2Line{ id: PC2LINE_DIFF_PC_MAX, name: "PC2LINE_DIFF_PC_MAX" });

    return codes;
  }

  std::vector<SpecialObject> QuickJSBinding::getSpecialObjects() {
    std::vector<SpecialObject> objects;

    objects.push_back(SpecialObject{ id: OP_SPECIAL_OBJECT_ARGUMENTS, name: "OP_SPECIAL_OBJECT_ARGUMENTS" });
    objects.push_back(SpecialObject{ id: OP_SPECIAL_OBJECT_MAPPED_ARGUMENTS, name: "OP_SPECIAL_OBJECT_MAPPED_ARGUMENTS" });
    objects.push_back(SpecialObject{ id: OP_SPECIAL_OBJECT_THIS_FUNC, name: "OP_SPECIAL_OBJECT_THIS_FUNC" });
    objects.push_back(SpecialObject{ id: OP_SPECIAL_OBJECT_NEW_TARGET, name: "OP_SPECIAL_OBJECT_NEW_TARGET" });
    objects.push_back(SpecialObject{ id: OP_SPECIAL_OBJECT_HOME_OBJECT, name: "OP_SPECIAL_OBJECT_HOME_OBJECT" });
    objects.push_back(SpecialObject{ id: OP_SPECIAL_OBJECT_VAR_OBJECT, name: "OP_SPECIAL_OBJECT_VAR_OBJECT" });
    objects.push_back(SpecialObject{ id: OP_SPECIAL_OBJECT_IMPORT_META, name: "OP_SPECIAL_OBJECT_IMPORT_META" });

    return objects;
  }

  std::vector<FunctionKind> QuickJSBinding::getFunctionKinds() {
    std::vector<FunctionKind> kinds;

    kinds.push_back(FunctionKind{ id: JS_FUNC_NORMAL, name: "JS_FUNC_NORMAL" });
    kinds.push_back(FunctionKind{ id: JS_FUNC_GENERATOR, name: "JS_FUNC_GENERATOR" });
    kinds.push_back(FunctionKind{ id: JS_FUNC_ASYNC, name: "JS_FUNC_ASYNC" });
    kinds.push_back(FunctionKind{ id: JS_FUNC_ASYNC_GENERATOR, name: "JS_FUNC_ASYNC_GENERATOR" });

    return kinds;
  }

  std::vector<BytecodeTag> QuickJSBinding::getBytecodeTags() {
    std::vector<BytecodeTag> tags;

    tags.push_back(BytecodeTag{ id: BC_TAG_NULL, name: "TC_TAG_NULL" });
    tags.push_back(BytecodeTag{ id: BC_TAG_UNDEFINED, name: "TC_TAG_UNDEFINED" });
    tags.push_back(BytecodeTag{ id: BC_TAG_BOOL_FALSE, name: "TC_TAG_BOOL_FALSE" });
    tags.push_back(BytecodeTag{ id: BC_TAG_BOOL_TRUE, name: "TC_TAG_BOOL_TRUE" });
    tags.push_back(BytecodeTag{ id: BC_TAG_INT32, name: "TC_TAG_INT32" });
    tags.push_back(BytecodeTag{ id: BC_TAG_FLOAT64, name: "TC_TAG_FLOAT64" });
    tags.push_back(BytecodeTag{ id: BC_TAG_STRING, name: "TC_TAG_STRING" });
    tags.push_back(BytecodeTag{ id: BC_TAG_OBJECT, name: "TC_TAG_OBJECT" });
    tags.push_back(BytecodeTag{ id: BC_TAG_ARRAY, name: "TC_TAG_ARRAY" });
    tags.push_back(BytecodeTag{ id: BC_TAG_BIG_INT, name: "TC_TAG_BIG_INT" });
    tags.push_back(BytecodeTag{ id: BC_TAG_TEMPLATE_OBJECT, name: "TC_TAG_TEMPLATE_OBJECT" });
    tags.push_back(BytecodeTag{ id: BC_TAG_FUNCTION_BYTECODE, name: "TC_TAG_FUNCTION_BYTECODE" });
    tags.push_back(BytecodeTag{ id: BC_TAG_MODULE, name: "TC_TAG_MODULE" });
    tags.push_back(BytecodeTag{ id: BC_TAG_TYPED_ARRAY, name: "TC_TAG_TYPED_ARRAY" });
    tags.push_back(BytecodeTag{ id: BC_TAG_ARRAY_BUFFER, name: "TC_TAG_ARRAY_BUFFER" });
    tags.push_back(BytecodeTag{ id: BC_TAG_SHARED_ARRAY_BUFFER, name: "TC_TAG_SHARED_ARRAY_BUFFER" });
    tags.push_back(BytecodeTag{ id: BC_TAG_DATE, name: "TC_TAG_DATE" });
    tags.push_back(BytecodeTag{ id: BC_TAG_OBJECT_VALUE, name: "TC_TAG_OBJECT_VALUE" });
    tags.push_back(BytecodeTag{ id: BC_TAG_OBJECT_REFERENCE, name: "TC_TAG_OBJECT_REFERENCE" });
    
    return tags;
  }

  int QuickJSBinding::getOpcodeId(std::string name) {
    // 定义 opcode 的 name 数组
    static const char* opcode_names[] = {
      #define FMT(f)
      #define DEF(id, size, n_pop, n_push, f) #id,
      #define def(id, size, n_pop, n_push, f)
      #include "QuickJS/quickjs-opcode.h"
      #undef def
      #undef DEF
      #undef FMT
    };

    // 在非临时 opcodes 中查找
    for (uint32_t i = 0; i < OP_COUNT; i++) {
      if (name == opcode_names[i]) {
        return static_cast<int>(i);
      }
    }

    // 定义临时 opcode 的 name 数组
    static const char* temp_opcode_names[] = {
      #define FMT(f)
      #define DEF(id, size, n_pop, n_push, f)
      #define def(id, size, n_pop, n_push, f) #id,
      #include "QuickJS/quickjs-opcode.h"
      #undef def
      #undef DEF
      #undef FMT
    };

    // 在临时 opcodes 中查找
    size_t temp_count = sizeof(temp_opcode_names) / sizeof(temp_opcode_names[0]);
    for (size_t i = 0; i < temp_count; i++) {
      if (name == temp_opcode_names[i]) {
        return static_cast<int>(OP_TEMP_START + i);
      }
    }

    return -1; // 未找到
  }

  std::vector<OpFmt> QuickJSBinding::getOpcodeFormats() {
    std::vector<OpFmt> formats;

    // 使用宏展开来填充格式数组
    #define FMT(f) formats.push_back(OpFmt{ static_cast<uint8_t>(OP_FMT_##f), #f });
    #define DEF(id, size, n_pop, n_push, f)
    #define def(id, size, n_pop, n_push, f)
    #include "QuickJS/quickjs-opcode.h"
    #undef def
    #undef DEF
    #undef FMT

    return formats;
  }

  std::vector<Op> QuickJSBinding::getOpcodes() {
    std::vector<Op> opcodes;

    // 定义 opcode 的 size 数组
    static const uint8_t opcode_size[] = {
      #define FMT(f)
      #define DEF(id, size, n_pop, n_push, f) size,
      #define def(id, size, n_pop, n_push, f)
      #include "QuickJS/quickjs-opcode.h"
      #undef def
      #undef DEF
      #undef FMT
    };

    // 定义 opcode 的 n_pop 数组
    static const uint8_t opcode_n_pop[] = {
      #define FMT(f)
      #define DEF(id, size, n_pop, n_push, f) n_pop,
      #define def(id, size, n_pop, n_push, f)
      #include "QuickJS/quickjs-opcode.h"
      #undef def
      #undef DEF
      #undef FMT
    };

    // 定义 opcode 的 n_push 数组
    static const uint8_t opcode_n_push[] = {
      #define FMT(f)
      #define DEF(id, size, n_pop, n_push, f) n_push,
      #define def(id, size, n_pop, n_push, f)
      #include "QuickJS/quickjs-opcode.h"
      #undef def
      #undef DEF
      #undef FMT
    };

    // 定义 opcode 的 fmt 数组
    static const uint8_t opcode_fmt[] = {
      #define FMT(f)
      #define DEF(id, size, n_pop, n_push, f) OP_FMT_##f,
      #define def(id, size, n_pop, n_push, f)
      #include "QuickJS/quickjs-opcode.h"
      #undef def
      #undef DEF
      #undef FMT
    };

    // 定义 opcode 的 name 数组
    static const char* opcode_names[] = {
      #define FMT(f)
      #define DEF(id, size, n_pop, n_push, f) #id,
      #define def(id, size, n_pop, n_push, f)
      #include "QuickJS/quickjs-opcode.h"
      #undef def
      #undef DEF
      #undef FMT
    };

    // 填充 DEF 定义的 opcodes (非临时 opcodes)
    for (uint32_t i = 0; i < OP_COUNT; i++) {
      opcodes.push_back(Op{
        i,
        opcode_names[i],
        opcode_n_pop[i],
        opcode_n_push[i],
        opcode_fmt[i],
        opcode_size[i],
        false  // isTemp = false
      });
    }

    // 定义临时 opcode 的数组 (def 小写定义的)
    static const uint8_t temp_opcode_size[] = {
      #define FMT(f)
      #define DEF(id, size, n_pop, n_push, f)
      #define def(id, size, n_pop, n_push, f) size,
      #include "QuickJS/quickjs-opcode.h"
      #undef def
      #undef DEF
      #undef FMT
    };

    static const uint8_t temp_opcode_n_pop[] = {
      #define FMT(f)
      #define DEF(id, size, n_pop, n_push, f)
      #define def(id, size, n_pop, n_push, f) n_pop,
      #include "QuickJS/quickjs-opcode.h"
      #undef def
      #undef DEF
      #undef FMT
    };

    static const uint8_t temp_opcode_n_push[] = {
      #define FMT(f)
      #define DEF(id, size, n_pop, n_push, f)
      #define def(id, size, n_pop, n_push, f) n_push,
      #include "QuickJS/quickjs-opcode.h"
      #undef def
      #undef DEF
      #undef FMT
    };

    static const uint8_t temp_opcode_fmt[] = {
      #define FMT(f)
      #define DEF(id, size, n_pop, n_push, f)
      #define def(id, size, n_pop, n_push, f) OP_FMT_##f,
      #include "QuickJS/quickjs-opcode.h"
      #undef def
      #undef DEF
      #undef FMT
    };

    static const char* temp_opcode_names[] = {
      #define FMT(f)
      #define DEF(id, size, n_pop, n_push, f)
      #define def(id, size, n_pop, n_push, f) #id,
      #include "QuickJS/quickjs-opcode.h"
      #undef def
      #undef DEF
      #undef FMT
    };

    // 填充临时 opcodes (从 OP_TEMP_START 开始)
    // 注意：临时 opcodes 的 ID 与 SHORT_OPCODES 重叠，它们只在编译阶段使用
    size_t temp_count = sizeof(temp_opcode_size) / sizeof(temp_opcode_size[0]);
    for (size_t i = 0; i < temp_count; i++) {
      opcodes.push_back(Op{
        static_cast<uint32_t>(OP_TEMP_START + i),
        temp_opcode_names[i],
        temp_opcode_n_pop[i],
        temp_opcode_n_push[i],
        temp_opcode_fmt[i],
        temp_opcode_size[i],
        true  // isTemp = true
      });
    }

    return opcodes;
  }
}
