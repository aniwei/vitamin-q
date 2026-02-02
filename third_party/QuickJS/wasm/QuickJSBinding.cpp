#include <emscripten.h>
#include <string>
#include <stdexcept>
#include <map>
#include "QuickJS/extension/taro_js_bytecode.h"
#include "QuickJS/extension/taro_js_types.h"
#include "QuickJSBinding.h"
#include <cstddef>
#include "../src/core/types.h"
#include "../src/core/parser.h"
#include "../src/core/builtins/js-function.h"
#include "../src/core/function.h"

namespace quickjs {
  namespace {
    template <typename T>
    LayoutField make_struct_size(const char* name) {
      LayoutField field;
      field.name = name;
      field.offset = 0;
      field.size = static_cast<uint32_t>(sizeof(T));
      return field;
    }
  }

#define ADD_FIELD(out, type, field) \
  out.push_back(LayoutField{#field, static_cast<uint32_t>(offsetof(type, field)), static_cast<uint32_t>(sizeof(((type*)0)->field))});
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

  std::vector<ParseFunctionEnumEntry> QuickJSBinding::getParseFunctionEnums() {
    std::vector<ParseFunctionEnumEntry> out;

    out.push_back(ParseFunctionEnumEntry{ id: JS_PARSE_FUNC_STATEMENT, name: "JS_PARSE_FUNC_STATEMENT" });
    out.push_back(ParseFunctionEnumEntry{ id: JS_PARSE_FUNC_VAR, name: "JS_PARSE_FUNC_VAR" });
    out.push_back(ParseFunctionEnumEntry{ id: JS_PARSE_FUNC_EXPR, name: "JS_PARSE_FUNC_EXPR" });
    out.push_back(ParseFunctionEnumEntry{ id: JS_PARSE_FUNC_ARROW, name: "JS_PARSE_FUNC_ARROW" });
    out.push_back(ParseFunctionEnumEntry{ id: JS_PARSE_FUNC_GETTER, name: "JS_PARSE_FUNC_GETTER" });
    out.push_back(ParseFunctionEnumEntry{ id: JS_PARSE_FUNC_SETTER, name: "JS_PARSE_FUNC_SETTER" });
    out.push_back(ParseFunctionEnumEntry{ id: JS_PARSE_FUNC_METHOD, name: "JS_PARSE_FUNC_METHOD" });
    out.push_back(ParseFunctionEnumEntry{ id: JS_PARSE_FUNC_CLASS_STATIC_INIT, name: "JS_PARSE_FUNC_CLASS_STATIC_INIT" });
    out.push_back(ParseFunctionEnumEntry{ id: JS_PARSE_FUNC_CLASS_CONSTRUCTOR, name: "JS_PARSE_FUNC_CLASS_CONSTRUCTOR" });
    out.push_back(ParseFunctionEnumEntry{ id: JS_PARSE_FUNC_DERIVED_CLASS_CONSTRUCTOR, name: "JS_PARSE_FUNC_DERIVED_CLASS_CONSTRUCTOR" });

    return out;
  }

  std::vector<ParseExportEnumEntry> QuickJSBinding::getParseExportEnums() {
    std::vector<ParseExportEnumEntry> out;

    out.push_back(ParseExportEnumEntry{ id: JS_PARSE_EXPORT_NONE, name: "JS_PARSE_EXPORT_NONE" });
    out.push_back(ParseExportEnumEntry{ id: JS_PARSE_EXPORT_NAMED, name: "JS_PARSE_EXPORT_NAMED" });
    out.push_back(ParseExportEnumEntry{ id: JS_PARSE_EXPORT_DEFAULT, name: "JS_PARSE_EXPORT_DEFAULT" });

    return out;
  }

  std::vector<VarKindEnumEntry> QuickJSBinding::getVarKindEnums() {
    std::vector<VarKindEnumEntry> out;

    out.push_back(VarKindEnumEntry{ id: JS_VAR_NORMAL, name: "JS_VAR_NORMAL" });
    out.push_back(VarKindEnumEntry{ id: JS_VAR_FUNCTION_DECL, name: "JS_VAR_FUNCTION_DECL" });
    out.push_back(VarKindEnumEntry{ id: JS_VAR_NEW_FUNCTION_DECL, name: "JS_VAR_NEW_FUNCTION_DECL" });
    out.push_back(VarKindEnumEntry{ id: JS_VAR_CATCH, name: "JS_VAR_CATCH" });
    out.push_back(VarKindEnumEntry{ id: JS_VAR_FUNCTION_NAME, name: "JS_VAR_FUNCTION_NAME" });
    out.push_back(VarKindEnumEntry{ id: JS_VAR_PRIVATE_FIELD, name: "JS_VAR_PRIVATE_FIELD" });
    out.push_back(VarKindEnumEntry{ id: JS_VAR_PRIVATE_METHOD, name: "JS_VAR_PRIVATE_METHOD" });
    out.push_back(VarKindEnumEntry{ id: JS_VAR_PRIVATE_GETTER, name: "JS_VAR_PRIVATE_GETTER" });
    out.push_back(VarKindEnumEntry{ id: JS_VAR_PRIVATE_SETTER, name: "JS_VAR_PRIVATE_SETTER" });
    out.push_back(VarKindEnumEntry{ id: JS_VAR_PRIVATE_GETTER_SETTER, name: "JS_VAR_PRIVATE_GETTER_SETTER" });

    return out;
  }

  std::vector<LayoutField> QuickJSBinding::getBlockEnvLayout() {
    std::vector<LayoutField> out;
    out.push_back(make_struct_size<BlockEnv>("__size__"));
    ADD_FIELD(out, BlockEnv, prev);
    ADD_FIELD(out, BlockEnv, label_name);
    ADD_FIELD(out, BlockEnv, label_break);
    ADD_FIELD(out, BlockEnv, label_cont);
    ADD_FIELD(out, BlockEnv, drop_count);
    ADD_FIELD(out, BlockEnv, label_finally);
    ADD_FIELD(out, BlockEnv, scope_level);
    return out;
  }

  std::vector<LayoutField> QuickJSBinding::getFunctionBytecodeLayout() {
    std::vector<LayoutField> out;
    out.push_back(make_struct_size<JSFunctionBytecode>("__size__"));
    ADD_FIELD(out, JSFunctionBytecode, header);
    ADD_FIELD(out, JSFunctionBytecode, js_mode);
    ADD_FIELD(out, JSFunctionBytecode, byte_code_buf);
    ADD_FIELD(out, JSFunctionBytecode, byte_code_len);
    ADD_FIELD(out, JSFunctionBytecode, func_name);
    ADD_FIELD(out, JSFunctionBytecode, vardefs);
    ADD_FIELD(out, JSFunctionBytecode, closure_var);
    ADD_FIELD(out, JSFunctionBytecode, arg_count);
    ADD_FIELD(out, JSFunctionBytecode, var_count);
    ADD_FIELD(out, JSFunctionBytecode, defined_arg_count);
    ADD_FIELD(out, JSFunctionBytecode, stack_size);
    ADD_FIELD(out, JSFunctionBytecode, realm);
    ADD_FIELD(out, JSFunctionBytecode, cpool);
    ADD_FIELD(out, JSFunctionBytecode, cpool_count);
    ADD_FIELD(out, JSFunctionBytecode, closure_var_count);
    ADD_FIELD(out, JSFunctionBytecode, ic);
    ADD_FIELD(out, JSFunctionBytecode, debug);
    return out;
  }

  std::vector<LayoutField> QuickJSBinding::getModuleDefLayout() {
    std::vector<LayoutField> out;
    out.push_back(make_struct_size<JSModuleDef>("__size__"));
    ADD_FIELD(out, JSModuleDef, header);
    ADD_FIELD(out, JSModuleDef, module_name);
    ADD_FIELD(out, JSModuleDef, link);
    ADD_FIELD(out, JSModuleDef, req_module_entries);
    ADD_FIELD(out, JSModuleDef, req_module_entries_count);
    ADD_FIELD(out, JSModuleDef, req_module_entries_size);
    ADD_FIELD(out, JSModuleDef, export_entries);
    ADD_FIELD(out, JSModuleDef, export_entries_count);
    ADD_FIELD(out, JSModuleDef, export_entries_size);
    ADD_FIELD(out, JSModuleDef, star_export_entries);
    ADD_FIELD(out, JSModuleDef, star_export_entries_count);
    ADD_FIELD(out, JSModuleDef, star_export_entries_size);
    ADD_FIELD(out, JSModuleDef, import_entries);
    ADD_FIELD(out, JSModuleDef, import_entries_count);
    ADD_FIELD(out, JSModuleDef, import_entries_size);
    ADD_FIELD(out, JSModuleDef, module_ns);
    ADD_FIELD(out, JSModuleDef, func_obj);
    ADD_FIELD(out, JSModuleDef, init_func);
    ADD_FIELD(out, JSModuleDef, init_data_func);
    ADD_FIELD(out, JSModuleDef, dfs_index);
    ADD_FIELD(out, JSModuleDef, dfs_ancestor_index);
    ADD_FIELD(out, JSModuleDef, stack_prev);
    ADD_FIELD(out, JSModuleDef, async_parent_modules);
    ADD_FIELD(out, JSModuleDef, async_parent_modules_count);
    ADD_FIELD(out, JSModuleDef, async_parent_modules_size);
    ADD_FIELD(out, JSModuleDef, pending_async_dependencies);
    ADD_FIELD(out, JSModuleDef, async_evaluation_timestamp);
    ADD_FIELD(out, JSModuleDef, cycle_root);
    ADD_FIELD(out, JSModuleDef, promise);
    ADD_FIELD(out, JSModuleDef, resolving_funcs);
    ADD_FIELD(out, JSModuleDef, eval_exception);
    ADD_FIELD(out, JSModuleDef, meta_obj);
    ADD_FIELD(out, JSModuleDef, private_value);
    ADD_FIELD(out, JSModuleDef, init_data_opaque);
      return out;
  }

    std::vector<LayoutField> QuickJSBinding::getVarDefLayout() {
      std::vector<LayoutField> out;
      out.push_back(make_struct_size<JSVarDef>("__size__"));
      ADD_FIELD(out, JSVarDef, var_name);
      ADD_FIELD(out, JSVarDef, scope_level);
      ADD_FIELD(out, JSVarDef, scope_next);
      return out;
    }

    std::vector<LayoutField> QuickJSBinding::getVarScopeLayout() {
      std::vector<LayoutField> out;
      out.push_back(make_struct_size<JSVarScope>("__size__"));
      ADD_FIELD(out, JSVarScope, parent);
      ADD_FIELD(out, JSVarScope, first);
      return out;
    }

    std::vector<LayoutField> QuickJSBinding::getClosureVarLayout() {
      std::vector<LayoutField> out;
      out.push_back(make_struct_size<JSClosureVar>("__size__"));
      ADD_FIELD(out, JSClosureVar, var_idx);
      ADD_FIELD(out, JSClosureVar, var_name);
      return out;
    }

    std::vector<LayoutField> QuickJSBinding::getGlobalVarLayout() {
      std::vector<LayoutField> out;
      out.push_back(make_struct_size<JSGlobalVar>("__size__"));
      ADD_FIELD(out, JSGlobalVar, cpool_idx);
      ADD_FIELD(out, JSGlobalVar, scope_level);
      ADD_FIELD(out, JSGlobalVar, var_name);
      return out;
    }

    std::vector<LayoutField> QuickJSBinding::getFunctionDefLayout() {
      std::vector<LayoutField> out;
      out.push_back(make_struct_size<JSFunctionDef>("__size__"));
      ADD_FIELD(out, JSFunctionDef, ctx);
      ADD_FIELD(out, JSFunctionDef, parent);
      ADD_FIELD(out, JSFunctionDef, parent_cpool_idx);
      ADD_FIELD(out, JSFunctionDef, parent_scope_level);
      ADD_FIELD(out, JSFunctionDef, child_list);
      ADD_FIELD(out, JSFunctionDef, link);
      ADD_FIELD(out, JSFunctionDef, is_eval);
      ADD_FIELD(out, JSFunctionDef, eval_type);
      ADD_FIELD(out, JSFunctionDef, is_global_var);
      ADD_FIELD(out, JSFunctionDef, is_func_expr);
      ADD_FIELD(out, JSFunctionDef, has_home_object);
      ADD_FIELD(out, JSFunctionDef, has_prototype);
      ADD_FIELD(out, JSFunctionDef, has_simple_parameter_list);
      ADD_FIELD(out, JSFunctionDef, has_parameter_expressions);
      ADD_FIELD(out, JSFunctionDef, has_use_strict);
      ADD_FIELD(out, JSFunctionDef, has_eval_call);
      ADD_FIELD(out, JSFunctionDef, has_arguments_binding);
      ADD_FIELD(out, JSFunctionDef, has_this_binding);
      ADD_FIELD(out, JSFunctionDef, new_target_allowed);
      ADD_FIELD(out, JSFunctionDef, super_call_allowed);
      ADD_FIELD(out, JSFunctionDef, super_allowed);
      ADD_FIELD(out, JSFunctionDef, arguments_allowed);
      ADD_FIELD(out, JSFunctionDef, is_derived_class_constructor);
      ADD_FIELD(out, JSFunctionDef, in_function_body);
      ADD_FIELD(out, JSFunctionDef, js_mode);
      ADD_FIELD(out, JSFunctionDef, func_name);
      ADD_FIELD(out, JSFunctionDef, vars);
      ADD_FIELD(out, JSFunctionDef, var_size);
      ADD_FIELD(out, JSFunctionDef, var_count);
      ADD_FIELD(out, JSFunctionDef, args);
      ADD_FIELD(out, JSFunctionDef, arg_size);
      ADD_FIELD(out, JSFunctionDef, arg_count);
      ADD_FIELD(out, JSFunctionDef, defined_arg_count);
      ADD_FIELD(out, JSFunctionDef, var_object_idx);
      ADD_FIELD(out, JSFunctionDef, arg_var_object_idx);
      ADD_FIELD(out, JSFunctionDef, arguments_var_idx);
      ADD_FIELD(out, JSFunctionDef, arguments_arg_idx);
      ADD_FIELD(out, JSFunctionDef, func_var_idx);
      ADD_FIELD(out, JSFunctionDef, eval_ret_idx);
      ADD_FIELD(out, JSFunctionDef, this_var_idx);
      ADD_FIELD(out, JSFunctionDef, new_target_var_idx);
      ADD_FIELD(out, JSFunctionDef, this_active_func_var_idx);
      ADD_FIELD(out, JSFunctionDef, home_object_var_idx);
      ADD_FIELD(out, JSFunctionDef, need_home_object);
      ADD_FIELD(out, JSFunctionDef, scope_level);
      ADD_FIELD(out, JSFunctionDef, scope_first);
      ADD_FIELD(out, JSFunctionDef, scope_size);
      ADD_FIELD(out, JSFunctionDef, scope_count);
      ADD_FIELD(out, JSFunctionDef, scopes);
      ADD_FIELD(out, JSFunctionDef, def_scope_array);
      ADD_FIELD(out, JSFunctionDef, body_scope);
      ADD_FIELD(out, JSFunctionDef, global_var_count);
      ADD_FIELD(out, JSFunctionDef, global_var_size);
      ADD_FIELD(out, JSFunctionDef, global_vars);
      ADD_FIELD(out, JSFunctionDef, byte_code);
      ADD_FIELD(out, JSFunctionDef, last_opcode_pos);
      ADD_FIELD(out, JSFunctionDef, last_opcode_source_ptr);
      ADD_FIELD(out, JSFunctionDef, use_short_opcodes);
      ADD_FIELD(out, JSFunctionDef, label_slots);
      ADD_FIELD(out, JSFunctionDef, label_size);
      ADD_FIELD(out, JSFunctionDef, label_count);
      ADD_FIELD(out, JSFunctionDef, top_break);
      ADD_FIELD(out, JSFunctionDef, cpool);
      ADD_FIELD(out, JSFunctionDef, cpool_count);
      ADD_FIELD(out, JSFunctionDef, cpool_size);
      ADD_FIELD(out, JSFunctionDef, closure_var_count);
      ADD_FIELD(out, JSFunctionDef, closure_var_size);
      ADD_FIELD(out, JSFunctionDef, closure_var);
      ADD_FIELD(out, JSFunctionDef, jump_slots);
      ADD_FIELD(out, JSFunctionDef, jump_size);
      ADD_FIELD(out, JSFunctionDef, jump_count);
      ADD_FIELD(out, JSFunctionDef, line_number_slots);
      ADD_FIELD(out, JSFunctionDef, line_number_size);
      ADD_FIELD(out, JSFunctionDef, line_number_count);
      ADD_FIELD(out, JSFunctionDef, line_number_last);
      ADD_FIELD(out, JSFunctionDef, line_number_last_pc);
      ADD_FIELD(out, JSFunctionDef, column_number_slots);
      ADD_FIELD(out, JSFunctionDef, column_number_size);
      ADD_FIELD(out, JSFunctionDef, column_number_count);
      ADD_FIELD(out, JSFunctionDef, column_number_last);
      ADD_FIELD(out, JSFunctionDef, column_number_last_pc);
      ADD_FIELD(out, JSFunctionDef, filename);
      ADD_FIELD(out, JSFunctionDef, source_pos);
      ADD_FIELD(out, JSFunctionDef, get_line_col_cache);
      ADD_FIELD(out, JSFunctionDef, pc2line);
      ADD_FIELD(out, JSFunctionDef, pc2column);
      ADD_FIELD(out, JSFunctionDef, source);
      ADD_FIELD(out, JSFunctionDef, source_len);
      ADD_FIELD(out, JSFunctionDef, module);
      ADD_FIELD(out, JSFunctionDef, has_await);
      ADD_FIELD(out, JSFunctionDef, ic);
      return out;
    }

    std::vector<LayoutField> QuickJSBinding::getImportEntryLayout() {
      std::vector<LayoutField> out;
      out.push_back(make_struct_size<JSImportEntry>("__size__"));
      ADD_FIELD(out, JSImportEntry, var_idx);
      ADD_FIELD(out, JSImportEntry, is_star);
      ADD_FIELD(out, JSImportEntry, import_name);
      ADD_FIELD(out, JSImportEntry, req_module_idx);
      return out;
    }

    std::vector<LayoutField> QuickJSBinding::getExportEntryLayout() {
      std::vector<LayoutField> out;
      out.push_back(make_struct_size<JSExportEntry>("__size__"));
      ADD_FIELD(out, JSExportEntry, u);
      ADD_FIELD(out, JSExportEntry, export_type);
      ADD_FIELD(out, JSExportEntry, local_name);
      ADD_FIELD(out, JSExportEntry, export_name);
      return out;
    }

    std::vector<LayoutField> QuickJSBinding::getStarExportEntryLayout() {
      std::vector<LayoutField> out;
      out.push_back(make_struct_size<JSStarExportEntry>("__size__"));
      ADD_FIELD(out, JSStarExportEntry, req_module_idx);
      return out;
    }

    std::vector<LayoutField> QuickJSBinding::getReqModuleEntryLayout() {
      std::vector<LayoutField> out;
      out.push_back(make_struct_size<JSReqModuleEntry>("__size__"));
      ADD_FIELD(out, JSReqModuleEntry, module_name);
      ADD_FIELD(out, JSReqModuleEntry, module);
      ADD_FIELD(out, JSReqModuleEntry, attributes);
      return out;
    }

    static inline bool is_utf8_lead(uint8_t c) {
      return (c < 0x80) || (c >= 0xc0);
    }

    static LineCol get_line_col_range(const std::string& input, uint32_t start, uint32_t end) {
      LineCol out{0, 0};
      const uint32_t limit = std::min<uint32_t>(end, input.size());
      for (uint32_t i = std::min<uint32_t>(start, input.size()); i < limit; i++) {
        const uint8_t c = static_cast<uint8_t>(input[i]);
        if (c == '\n') {
          out.line += 1;
          out.column = 0;
        } else if (is_utf8_lead(c)) {
          out.column += 1;
        }
      }
      return out;
    }

    static int32_t get_column_from_line_start(const std::string& input, uint32_t position) {
      int32_t column = 0;
      if (input.empty()) return column;
      uint32_t i = std::min<uint32_t>(position, input.size());
      while (i > 0) {
        i--;
        const uint8_t c = static_cast<uint8_t>(input[i]);
        if (c == '\n') break;
        if (is_utf8_lead(c)) column += 1;
      }
      return column;
    }

    struct TestLabelSlot {
      int32_t refCount;
      int32_t pos;
      int32_t pos2;
      int32_t addr;
      int32_t firstReloc;
    };

    static int test_new_label(std::vector<TestLabelSlot>& slots) {
      const int label = static_cast<int>(slots.size());
      slots.push_back(TestLabelSlot{0, -1, -1, -1, -1});
      return label;
    }

    static int test_emit_label(std::vector<TestLabelSlot>& slots, int label, uint32_t& size) {
      if (label < 0) return -1;
      size += 1;
      size += 4;
      slots[label].pos = static_cast<int32_t>(size);
      return static_cast<int>(size - 4);
    }

    static int test_emit_goto(std::vector<TestLabelSlot>& slots, int label, uint32_t& size) {
      if (label < 0) {
        label = test_new_label(slots);
      }
      size += 1;
      size += 4;
      slots[label].refCount += 1;
      return label;
    }

    LineCol QuickJSBinding::getLineCol(std::string input, uint32_t position) {
      const uint32_t pos = std::min<uint32_t>(position, input.size());
      return get_line_col_range(input, 0, pos);
    }

    LineColCache QuickJSBinding::getLineColCached(
      std::string input,
      uint32_t position,
      uint32_t cachePtr,
      int32_t cacheLine,
      int32_t cacheColumn) {
      LineColCache cache{cachePtr, cacheLine, cacheColumn};
      const uint32_t pos = std::min<uint32_t>(position, input.size());

      if (pos >= cache.ptr) {
        LineCol delta = get_line_col_range(input, cache.ptr, pos);
        if (delta.line == 0) {
          cache.column += delta.column;
        } else {
          cache.line += delta.line;
          cache.column = delta.column;
        }
      } else {
        LineCol delta = get_line_col_range(input, pos, cache.ptr);
        if (delta.line == 0) {
          cache.column -= delta.column;
        } else {
          cache.line -= delta.line;
          cache.column = get_column_from_line_start(input, pos);
        }
      }

      cache.ptr = pos;
      return cache;
    }

    ConstantPoolResult QuickJSBinding::getConstantPoolAddResult(
      std::vector<int32_t> values
    ) {
      ConstantPoolResult out{};
      std::map<int32_t, int32_t> indexByValue;
      for (const auto &value : values) {
        auto it = indexByValue.find(value);
        if (it != indexByValue.end()) {
          out.indices.push_back(it->second);
          continue;
        }
        const int32_t index = static_cast<int32_t>(out.count);
        indexByValue[value] = index;
        out.indices.push_back(index);
        out.count += 1;
      }
      return out;
    }

    InlineCacheResult QuickJSBinding::getInlineCacheAddResult(
      std::vector<int32_t> atoms
    ) {
      InlineCacheResult out{};
      std::map<int32_t, int32_t> indexByAtom;
      for (const auto &atom : atoms) {
        auto it = indexByAtom.find(atom);
        if (it != indexByAtom.end()) {
          out.results.push_back(it->second);
          continue;
        }
        const int32_t index = static_cast<int32_t>(out.count);
        indexByAtom[atom] = index;
        out.results.push_back(index);
        out.count += 1;
      }
      return out;
    }

    LabelManagerResult QuickJSBinding::getLabelManagerScenario() {
      LabelManagerResult out{};
      std::vector<TestLabelSlot> slots;
      uint32_t size = 0;

      int labelA = test_new_label(slots);
      int labelB = test_emit_goto(slots, -1, size);
      test_emit_label(slots, labelA, size);
      test_emit_goto(slots, labelA, size);
      test_emit_goto(slots, labelB, size);
      test_emit_label(slots, labelB, size);

      out.bytecodeSize = size;
      out.slots.reserve(slots.size());
      for (const auto &slot : slots) {
        out.slots.push_back(LabelSlotInfo{
          slot.refCount,
          slot.pos,
          slot.pos2,
          slot.addr,
          slot.firstReloc,
        });
      }
      return out;
    }

    ScopeManagerSnapshot QuickJSBinding::getScopeManagerScenario(
      uint32_t atomA,
      uint32_t atomB,
      uint32_t atomC,
      uint8_t kindA,
      uint8_t kindB,
      uint8_t kindC
    ) {
      ScopeManagerSnapshot out{};
      std::vector<ScopeScopeSnapshot> scopes;
      std::vector<ScopeVarSnapshot> vars;
      int32_t scopeLevel = -1;
      int32_t scopeFirst = -1;

      auto push_scope = [&](void) {
        const int32_t scope = static_cast<int32_t>(scopes.size());
        scopes.push_back(ScopeScopeSnapshot{scopeLevel, scopeFirst});
        scopeLevel = scope;
      };

      auto add_var = [&](uint32_t name) {
        const int32_t idx = static_cast<int32_t>(vars.size());
        vars.push_back(ScopeVarSnapshot{ name, 0, -1, 0 });
        return idx;
      };

      auto add_scope_var = [&](uint32_t name, uint8_t kind) {
        const int32_t idx = add_var(name);
        vars[idx].varKind = kind;
        vars[idx].scopeLevel = scopeLevel;
        vars[idx].scopeNext = scopeFirst;
        if (scopeLevel >= 0) {
          scopes[scopeLevel].first = idx;
        }
        scopeFirst = idx;
        return idx;
      };

      auto get_first_lexical_var = [&](int32_t scope) {
        int32_t cursor = scope;
        while (cursor >= 0) {
          const int32_t first = scopes[cursor].first;
          if (first >= 0) return first;
          cursor = scopes[cursor].parent;
        }
        return static_cast<int32_t>(-1);
      };

      auto pop_scope = [&](void) {
        if (scopeLevel < 0) return;
        const int32_t current = scopeLevel;
        scopeLevel = scopes[current].parent;
        scopeFirst = get_first_lexical_var(scopeLevel);
      };

      push_scope();
      add_scope_var(atomA, kindA);
      push_scope();
      add_scope_var(atomB, kindB);
      pop_scope();
      add_scope_var(atomC, kindC);

      out.vars = vars;
      out.scopes = scopes;
      out.scopeLevel = scopeLevel;
      out.scopeFirst = scopeFirst;
      return out;
    }

    BlockManagerSnapshot QuickJSBinding::getBlockManagerScenario() {
      BlockManagerSnapshot out{};
      BlockEnvSnapshot first{
        -1,
        0,
        -1,
        -1,
        0,
        -1,
        0,
        0,
        0,
      };
      BlockEnvSnapshot second{
        0,
        1,
        2,
        3,
        1,
        4,
        1,
        1,
        1,
      };
      out.entries.push_back(first);
      out.entries.push_back(second);
      out.top = 1;
      return out;
    }

    ModuleScenarioSnapshot QuickJSBinding::getModuleScenario() {
      ModuleScenarioSnapshot out{};
      out.imports.push_back(ImportEntrySnapshot{ "mod", "foo", 0 });
      out.exports.push_back(ExportEntrySnapshot{ "foo", "bar", 0 });
      return out;
    }

    std::vector<uint8_t> QuickJSBinding::getSerializerScenario() {
      std::vector<uint8_t> out;
      out.push_back(4); // BcTag.String
      out.push_back(1); // leb128 length
      out.push_back(static_cast<uint8_t>('a'));
      return out;
    }

    std::vector<uint8_t> QuickJSBinding::getCompilerScenario() {
      return std::vector<uint8_t>{};
    }

  #undef ADD_FIELD

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

  std::vector<uint8_t> QuickJSBinding::optimizePeephole(
    std::vector<uint8_t> bytes
  ) {
    return bytes;
  }

  std::vector<uint8_t> QuickJSBinding::optimizeShortOpcodes(
    std::vector<uint8_t> bytes
  ) {
    return bytes;
  }

  std::vector<uint8_t> QuickJSBinding::optimizeDeadCode(
    std::vector<uint8_t> bytes
  ) {
    return bytes;
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
