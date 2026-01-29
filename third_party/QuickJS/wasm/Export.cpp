#include <emscripten/bind.h>
#include <string>
#include "QuickJS/extension/taro_js_bytecode.h"
#include "Export.h"

using namespace emscripten;
using namespace quickjs;

EMSCRIPTEN_BINDINGS(quickjs_wasm) {
  register_vector<uint8_t>("Uint8Array");
  register_vector<std::string>("StringArray");
  register_vector<Op>("OpArray");
  register_vector<Atom>("AtomArray");
  register_vector<OpFmt>("OpFormatArray");
  register_vector<BytecodeTag>("BytecodeTagArray");
  register_vector<FunctionKind>("FunctionKindArray");
  register_vector<JSMode>("JSModeArray");
  register_vector<PC2Line>("PC2LineArray");
  register_vector<SpecialObject>("SpecialObjectArray");
  register_vector<ParseFunctionEnumEntry>("ParseFunctionEnumArray");
  register_vector<ParseExportEnumEntry>("ParseExportEnumArray");
  register_vector<VarKindEnumEntry>("VarKindEnumArray");
  register_vector<LayoutField>("LayoutFieldArray");

  enum_<CompileFlags>("CompileFlags")
    .value("COMPILE_FLAG_NONE", COMPILE_FLAG_NONE)
    .value("COMPILE_FLAG_DUMP", COMPILE_FLAG_DUMP)
    .value("COMPILE_FLAG_BIGNUM", COMPILE_FLAG_BIGNUM)
    .value("COMPILE_FLAG_SHORT_OPCODES", COMPILE_FLAG_SHORT_OPCODES);

  enum_<PutLValueEnum>("PutLValueEnum")
    .value("PUT_LVALUE_NOKEEP", PUT_LVALUE_NOKEEP)
    .value("PUT_LVALUE_NOKEEP_DEPTH", PUT_LVALUE_NOKEEP_DEPTH)
    .value("PUT_LVALUE_KEEP_TOP", PUT_LVALUE_KEEP_TOP)
    .value("PUT_LVALUE_KEEP_SECOND", PUT_LVALUE_KEEP_SECOND)
    .value("PUT_LVALUE_NOKEEP_BOTTOM", PUT_LVALUE_NOKEEP_BOTTOM);

  class_<Op>("Op")
    .constructor<>()
    .property("id", &Op::id)
    .property("name", &Op::name)
    .property("nPop", &Op::nPop)
    .property("nPush", &Op::nPush)
    .property("fmt", &Op::fmt)
    .property("size", &Op::size)
    .property("isTemp", &Op::isTemp);
  

  class_<Atom>("Atom")
    .constructor<>()
    .property("id", &Atom::id)
    .property("name", &Atom::name);
  
  class_<OpFmt>("OpFmt")
    .constructor<>()
    .property("id", &OpFmt::id)
    .property("name", &OpFmt::name);


  class_<BytecodeTag>("BytecodeTag")
    .constructor<>()
    .property("id", &BytecodeTag::id)
    .property("name", &BytecodeTag::name);

  class_<FunctionKind>("FunctionKind")
    .constructor<>()
    .property("id", &FunctionKind::id)
    .property("name", &FunctionKind::name);

  class_<PC2Line>("PC2Line")
    .constructor<>()
    .property("id", &PC2Line::id)
    .property("name", &PC2Line::name);

  class_<JSMode>("JSMode")
    .constructor<>()
    .property("id", &JSMode::id)
    .property("name", &JSMode::name);

  class_<SpecialObject>("SpecialObject")
    .constructor<>()
    .property("id", &SpecialObject::id)
    .property("name", &SpecialObject::name);

  class_<ParseFunctionEnumEntry>("ParseFunctionEnumEntry")
    .constructor<>()
    .property("id", &ParseFunctionEnumEntry::id)
    .property("name", &ParseFunctionEnumEntry::name);

  class_<ParseExportEnumEntry>("ParseExportEnumEntry")
    .constructor<>()
    .property("id", &ParseExportEnumEntry::id)
    .property("name", &ParseExportEnumEntry::name);

  class_<VarKindEnumEntry>("VarKindEnumEntry")
    .constructor<>()
    .property("id", &VarKindEnumEntry::id)
    .property("name", &VarKindEnumEntry::name);

  class_<LayoutField>("LayoutField")
    .constructor<>()
    .property("name", &LayoutField::name)
    .property("offset", &LayoutField::offset)
    .property("size", &LayoutField::size);

  class_<QuickJSBinding>("QuickJSBinding")
    .constructor<>()
    .class_function("compile", &QuickJSBinding::compile)
    .class_function("compileScript", &QuickJSBinding::compileScript)
    .class_function("dumpWithBinary", &QuickJSBinding::dumpWithBinary)
    .class_function("runWithBinary", &QuickJSBinding::runWithBinary)
    .class_function("getBytecodeVersion", &QuickJSBinding::getBytecodeVersion)
    .class_function("getCompileOptions", &QuickJSBinding::getCompileOptions)
    .class_function("getFirstAtomId", &QuickJSBinding::getFirstAtomId)
    .class_function("getGlobalVarOffset", &QuickJSBinding::getGlobalVarOffset)
    .class_function("getArgumentVarOffset", &QuickJSBinding::getArgumentVarOffset)
    .class_function("getArgScopeIndex", &QuickJSBinding::getArgScopeIndex)
    .class_function("getArgScopeEnd", &QuickJSBinding::getArgScopeEnd)
    .class_function("getDebugScopeIndex", &QuickJSBinding::getDebugScopeIndex)
    .class_function("getMaxLocalVars", &QuickJSBinding::getMaxLocalVars)
    .class_function("getStackSizeMax", &QuickJSBinding::getStackSizeMax)
    .class_function("getAtoms", &QuickJSBinding::getAtoms)
    .class_function("getEnvironmentAtoms", &QuickJSBinding::getEnvironmentAtoms)
    .class_function("getOpcodeFormats", &QuickJSBinding::getOpcodeFormats)
    .class_function("getOpcodes", &QuickJSBinding::getOpcodes)
    .class_function("getOpcodeId", &QuickJSBinding::getOpcodeId)
    .class_function("getBytecodeTags", &QuickJSBinding::getBytecodeTags)
    .class_function("getFunctionKinds", &QuickJSBinding::getFunctionKinds)
    .class_function("getJSModes", &QuickJSBinding::getJSModes)
    .class_function("getPC2LineCodes", &QuickJSBinding::getPC2LineCodes)
    .class_function("getSpecialObjects", &QuickJSBinding::getSpecialObjects)
    .class_function("getParseFunctionEnums", &QuickJSBinding::getParseFunctionEnums)
    .class_function("getParseExportEnums", &QuickJSBinding::getParseExportEnums)
    .class_function("getVarKindEnums", &QuickJSBinding::getVarKindEnums)
    .class_function("getBlockEnvLayout", &QuickJSBinding::getBlockEnvLayout)
    .class_function("getFunctionBytecodeLayout", &QuickJSBinding::getFunctionBytecodeLayout)
    .class_function("getModuleDefLayout", &QuickJSBinding::getModuleDefLayout)
    .class_function("getFunctionDefLayout", &QuickJSBinding::getFunctionDefLayout)
    .class_function("getVarDefLayout", &QuickJSBinding::getVarDefLayout)
    .class_function("getVarScopeLayout", &QuickJSBinding::getVarScopeLayout)
    .class_function("getClosureVarLayout", &QuickJSBinding::getClosureVarLayout)
    .class_function("getGlobalVarLayout", &QuickJSBinding::getGlobalVarLayout)
    .smart_ptr<std::shared_ptr<QuickJSBinding>>("shared_ptr<QuickJSBinding>");
}
