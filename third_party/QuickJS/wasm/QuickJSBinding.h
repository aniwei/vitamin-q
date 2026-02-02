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

struct ParseFunctionEnumEntry {
  uint32_t id;
  std::string name;
};

struct ParseExportEnumEntry {
  uint32_t id;
  std::string name;
};

struct VarKindEnumEntry {
  uint32_t id;
  std::string name;
};

struct LayoutField {
  std::string name;
  uint32_t offset;
  uint32_t size;
};

struct LineCol {
  int32_t line;
  int32_t column;
};

struct LineColCache {
  uint32_t ptr;
  int32_t line;
  int32_t column;
};

struct ConstantPoolResult {
  std::vector<int32_t> indices;
  uint32_t count;
};

struct InlineCacheResult {
  std::vector<int32_t> results;
  uint32_t count;
};

struct LabelSlotInfo {
  int32_t refCount;
  int32_t pos;
  int32_t pos2;
  int32_t addr;
  int32_t firstReloc;
};

struct LabelManagerResult {
  std::vector<LabelSlotInfo> slots;
  uint32_t bytecodeSize;
};

struct ScopeVarSnapshot {
  uint32_t varName;
  int32_t scopeLevel;
  int32_t scopeNext;
  uint8_t varKind;
};

struct ScopeScopeSnapshot {
  int32_t parent;
  int32_t first;
};

struct ScopeManagerSnapshot {
  std::vector<ScopeVarSnapshot> vars;
  std::vector<ScopeScopeSnapshot> scopes;
  int32_t scopeLevel;
  int32_t scopeFirst;
};

struct BlockEnvSnapshot {
  int32_t prev;
  int32_t labelName;
  int32_t labelBreak;
  int32_t labelCont;
  int32_t dropCount;
  int32_t labelFinally;
  int32_t scopeLevel;
  int32_t hasIterator;
  int32_t isRegularStmt;
};

struct BlockManagerSnapshot {
  std::vector<BlockEnvSnapshot> entries;
  int32_t top;
};

struct ImportEntrySnapshot {
  std::string moduleName;
  std::string importName;
  int32_t isStar;
};

struct ExportEntrySnapshot {
  std::string localName;
  std::string exportName;
  int32_t exportType;
};

struct ModuleScenarioSnapshot {
  std::vector<ImportEntrySnapshot> imports;
  std::vector<ExportEntrySnapshot> exports;
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
  static std::vector<ParseFunctionEnumEntry> getParseFunctionEnums();
  static std::vector<ParseExportEnumEntry> getParseExportEnums();
  static std::vector<VarKindEnumEntry> getVarKindEnums();
  static std::vector<LayoutField> getBlockEnvLayout();
  static std::vector<LayoutField> getFunctionBytecodeLayout();
  static std::vector<LayoutField> getModuleDefLayout();
  static std::vector<LayoutField> getFunctionDefLayout();
  static std::vector<LayoutField> getVarDefLayout();
  static std::vector<LayoutField> getVarScopeLayout();
  static std::vector<LayoutField> getClosureVarLayout();
  static std::vector<LayoutField> getGlobalVarLayout();
  static std::vector<LayoutField> getImportEntryLayout();
  static std::vector<LayoutField> getExportEntryLayout();
  static std::vector<LayoutField> getStarExportEntryLayout();
  static std::vector<LayoutField> getReqModuleEntryLayout();

  static LineCol getLineCol(
    std::string input,
    uint32_t position);

  static LineColCache getLineColCached(
    std::string input,
    uint32_t position,
    uint32_t cachePtr,
    int32_t cacheLine,
    int32_t cacheColumn);

  static ConstantPoolResult getConstantPoolAddResult(
    std::vector<int32_t> values);

  static InlineCacheResult getInlineCacheAddResult(
    std::vector<int32_t> atoms);

  static LabelManagerResult getLabelManagerScenario();

  static ScopeManagerSnapshot getScopeManagerScenario(
    uint32_t atomA,
    uint32_t atomB,
    uint32_t atomC,
    uint8_t kindA,
    uint8_t kindB,
    uint8_t kindC);

  static BlockManagerSnapshot getBlockManagerScenario();
  static ModuleScenarioSnapshot getModuleScenario();
  static std::vector<uint8_t> getSerializerScenario();
  static std::vector<uint8_t> getCompilerScenario();

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

  static std::vector<uint8_t> optimizePeephole(
    std::vector<uint8_t> bytes);

  static std::vector<uint8_t> optimizeShortOpcodes(
    std::vector<uint8_t> bytes);

  static std::vector<uint8_t> optimizeDeadCode(
    std::vector<uint8_t> bytes);
};
} // namespace quickjs
