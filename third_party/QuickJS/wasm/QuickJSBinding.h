#pragma once
#include <emscripten/val.h>
#include <vector>
#include <map>
#include "QuickJS/quickjs.h"

using namespace emscripten;

namespace quickjs {

enum CompileFlags {
  COMPILE_FLAG_NONE = 0,
  COMPILE_FLAG_DUMP = 1 << 0,
  COMPILE_FLAG_BIGNUM = 1 << 1,
  COMPILE_FLAG_SHORT_OPCODES = 1 << 2,
};

enum PutLValueEnum {
  PUT_LVALUE_NOKEEP = 0,
  PUT_LVALUE_NOKEEP_DEPTH = 1,
  PUT_LVALUE_KEEP_TOP = 2,
  PUT_LVALUE_KEEP_SECOND = 3,
  PUT_LVALUE_NOKEEP_BOTTOM = 4,
};

struct Op {
  uint32_t id;
  std::string name;
  uint8_t nPop;
  uint8_t nPush;
  uint8_t fmt;
  uint8_t size;
  bool isTemp;
};

struct Atom {
  uint32_t id;
  std::string name;
};

struct OpFmt {
  uint8_t id;
  std::string name;
};

struct BytecodeTag {
  uint32_t id;
  std::string name;
};

struct FunctionKind {
  uint32_t id;
  std::string name;
};

struct JSMode {
  uint32_t id;
  std::string name;
};

struct PC2Line {
  int32_t id;
  std::string name;
};

struct SpecialObject {
  int32_t id;
  std::string name;
};

class QuickJSBinding {
  using Ptr = std::shared_ptr<QuickJSBinding>;

 public:
  QuickJSBinding();

  static JSModuleDef* resolve(
    JSContext* context, 
    const char* moduleName, 
    void* opaque);

 private:
  static JSContext* prepare(
    std::vector<std::string> modules);
  
 public:
  static std::vector<uint8_t> compile(
    std::string input,
    std::string sourceURL, 
    std::vector<std::string> modules);

  static std::vector<uint8_t> compileScript(
    std::string input,
    std::string sourceURL, 
    std::vector<std::string> modules);

 private:
  static std::vector<uint8_t> compileWithFlags(
    std::string input,
    std::string sourceURL, 
    std::vector<std::string> modules,
    int evalFlags);

 public:

  static uint32_t getBytecodeVersion();
  static uint32_t getCompileOptions();
  static uint32_t getFirstAtomId();

  static uint32_t getGlobalVarOffset();
  static uint32_t getArgumentVarOffset();
  static int32_t getArgScopeIndex();
  static int32_t getArgScopeEnd();
  static int32_t getDebugScopeIndex();
  static int32_t getMaxLocalVars();
  static int32_t getStackSizeMax();

  static std::vector<BytecodeTag> getBytecodeTags();
  static std::vector<FunctionKind> getFunctionKinds();
  static std::vector<JSMode> getJSModes();
  static std::vector<PC2Line> getPC2LineCodes();
  static std::vector<SpecialObject> getSpecialObjects();

  static std::vector<Atom> getAtoms();
  static std::vector<Atom> getEnvironmentAtoms();
  static std::vector<OpFmt> getOpcodeFormats();
  static std::vector<Op> getOpcodes();
  static int getOpcodeId(std::string name);

  static std::string dumpWithBinary(
    std::vector<uint8_t> bytes,
    std::vector<std::string> modules);

  static std::string runWithBinary(
    std::vector<uint8_t> bytes, 
    std::vector<std::string> modules);
};
} // namespace quickjs
