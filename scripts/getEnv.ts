import { QuickJSLib } from './QuickJSLib'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

async function main() {
  const envPath = resolve(process.cwd(), 'src/env.ts')
  
  const compileFlags = await QuickJSLib.getCompileEnums()
  const putLValueEnum = await QuickJSLib.getPutLValueEnum()
  const bytecodeTags = await QuickJSLib.getAllBytecodeTags()
  const functionKinds = await QuickJSLib.getFunctionKinds()
  const jsModes = await QuickJSLib.getJSModes()
  const pc2LineCodes = await QuickJSLib.getPC2LineCodes()
  const specialObjects = await QuickJSLib.getSpecialObjects()
  const opFormats = await QuickJSLib.getAllOpcodeFormats()
  const opcodes = await QuickJSLib.getAllOpcodes()
  const atoms = await QuickJSLib.getAllAtoms()
  const envAtoms = await QuickJSLib.getEnvironmentAtoms()
  const bytecodeVersion = await QuickJSLib.getBytecodeVersion()
  const compileOptions = await QuickJSLib.getCompileOptions()
  const firstAtomId = await QuickJSLib.getFirstAtomId()
  const globalVarOffset = await QuickJSLib.getGlobalVarOffset()
  const argumentVarOffset = await QuickJSLib.getArgumentVarOffset()
  const argScopeIndex = await QuickJSLib.getArgScopeIndex()
  const argScopeEnd = await QuickJSLib.getArgScopeEnd()
  const debugScopeIndex = await QuickJSLib.getDebugScopeIndex()
  const maxLocalVars = await QuickJSLib.getMaxLocalVars()
  const stackSizeMax = await QuickJSLib.getStackSizeMax()

  const lines: string[] = []
  lines.push(`// 本文件由 scripts/getEnv.ts 自动生成`)
  lines.push(`// 请勿手工编辑。`)
  lines.push(`// 生成时间: ${new Date().toISOString()}`)
  lines.push(``)

  // Constants
  lines.push(`export const GLOBAL_VAR_OFFSET = ${globalVarOffset}`)
  lines.push(`export const ARGUMENT_VAR_OFFSET = ${argumentVarOffset}`)
  lines.push(`export const ARG_SCOPE_INDEX = ${argScopeIndex}`)
  lines.push(`export const ARG_SCOPE_END = ${argScopeEnd}`)
  lines.push(`export const DEBUG_SCOPE_INDEX = ${debugScopeIndex}`)
  lines.push(`export const JS_MAX_LOCAL_VARS = ${maxLocalVars}`)
  lines.push(`export const JS_STACK_SIZE_MAX = ${stackSizeMax}`)
  lines.push(``)
  
  // 基于 compileOptions 推导的常量
  const COMPILE_FLAG_SHORT_OPCODES = compileFlags['COMPILE_FLAG_SHORT_OPCODES'] || 4
  const JS_MODE_STRICT_VALUE = jsModes['JS_MODE_STRICT'] || 1
  const hasShortOpcodes = (compileOptions & COMPILE_FLAG_SHORT_OPCODES) !== 0
  lines.push(`// 基于 compileOptions 推导的常量`)
  lines.push(`export const COMPILE_OPTIONS = ${compileOptions}`)
  lines.push(`export const SHORT_OPCODES = ${hasShortOpcodes}`)
  lines.push(`export const JS_MODE_STRICT_DEFAULT = ${JS_MODE_STRICT_VALUE}`)
  lines.push(`export const BYTECODE_VERSION = ${bytecodeVersion}`)
  lines.push(`export const FIRST_ATOM_ID = ${firstAtomId}`)
  lines.push(``)

  // QuickJS 常量（来自 QuickJS 头文件；用于 TS 侧对齐与消除魔数）
  lines.push(`// QuickJS 常量（来自 QuickJS 头文件；用于 TS 侧对齐与消除魔数）`)
  lines.push(`// third_party/QuickJS/include/QuickJS/quickjs.h:61-62`)
  lines.push(`export const JS_PROP_CONFIGURABLE = ${1 << 0}`)
  lines.push(`export const JS_PROP_WRITABLE = ${1 << 1}`)
  lines.push(`// third_party/QuickJS/include/QuickJS/quickjs.h:96-103`)
  lines.push(`export const JS_EVAL_TYPE_GLOBAL = ${0 << 0}`)
  lines.push(`export const JS_EVAL_TYPE_MODULE = ${1 << 0}`)
  lines.push(`export const JS_EVAL_TYPE_DIRECT = ${2 << 0}`)
  lines.push(`export const JS_EVAL_TYPE_INDIRECT = ${3 << 0}`)
  lines.push(`export const JS_EVAL_TYPE_MASK = ${3 << 0}`)
  lines.push(`// third_party/QuickJS/src/core/function.h:40-44`)
  lines.push(`export const JS_THROW_VAR_RO = ${0}`)
  lines.push(`export const JS_THROW_VAR_REDECL = ${1}`)
  lines.push(`export const JS_THROW_VAR_UNINITIALIZED = ${2}`)
  lines.push(`// third_party/QuickJS/src/core/function.h:34-38`)
  lines.push(`export const OP_DEFINE_METHOD_METHOD = ${0}`)
  lines.push(`export const OP_DEFINE_METHOD_GETTER = ${1}`)
  lines.push(`export const OP_DEFINE_METHOD_SETTER = ${2}`)
  lines.push(`export const OP_DEFINE_METHOD_ENUMERABLE = ${4}`)
  lines.push(`// third_party/QuickJS/src/core/runtime.h:50-51`)
  lines.push(`export const DEFINE_GLOBAL_LEX_VAR = ${1 << 7}`)
  lines.push(`export const DEFINE_GLOBAL_FUNC_VAR = ${1 << 6}`)
  lines.push(`// third_party/QuickJS/src/core/exception.h:32`)
  lines.push(`export const JS_DEFINE_CLASS_HAS_HERITAGE = ${1 << 0}`)
  lines.push(`// third_party/QuickJS/include/QuickJS/quickjs.h:237`)
  lines.push(`export const JS_ATOM_NULL = ${0}`)
  lines.push(``)

  // QuickJS 编译器实现细节常量（来自 QuickJS parser.c；用于 TS 侧对齐与消除魔数）
  lines.push(`// QuickJS 编译器实现细节常量（来自 QuickJS parser.c；用于 TS 侧对齐与消除魔数）`)
  lines.push(`// third_party/QuickJS/src/core/parser.c:12248-12252 (compute_stack_size: stack_level_tab 初始化为 0xffff)`)
  lines.push(`export const STACK_LEVEL_UNSET = ${0xffff}`)
  lines.push(`// QuickJS 字节码 op 数量上限（compute_stack_size 中用于校验）`)
  lines.push(`export const OP_COUNT = 256`)
  lines.push(`// third_party/QuickJS/src/core/parser.c:6900-6905 (js_parse_for_in_of: OP_for_of_next 的默认操作数)`)
  lines.push(`export const FOR_OF_NEXT_OPERAND_DEFAULT = ${0}`)
  lines.push(``)

  // QuickJS 字节码格式常量（来自 QuickJS bytecode.cpp；用于读写 .qbc 时对齐与消除魔数）
  lines.push(`// QuickJS 字节码格式常量（来自 QuickJS bytecode.cpp；用于读写 .qbc 时对齐与消除魔数）`)
  lines.push(`// third_party/QuickJS/src/core/bytecode.cpp:448-461 (bc_set_flags: flags bit layout)`)
  lines.push(`export const JS_FUNCTION_BYTECODE_FLAG_HAS_DEBUG = ${1 << 10}`)
  lines.push(``)

  // CompileFlags
  lines.push(`export enum CompileFlags {`)
  for (const [key, value] of Object.entries(compileFlags)) {
    lines.push(`  ${key} = ${value},`)
  }
  lines.push(`}`)
  lines.push(``)

  // PutLValueEnum
  lines.push(`export enum PutLValueEnum {`)
  for (const [key, value] of Object.entries(putLValueEnum)) {
    lines.push(`  ${key} = ${value},`)
  }
  lines.push(`}`)
  lines.push(``)

  // BytecodeTag
  lines.push(`export enum BytecodeTag {`)
  for (const [key, value] of Object.entries(bytecodeTags)) {
    lines.push(`  ${key} = ${value},`)
  }
  lines.push(`}`)
  lines.push(``)

  // FunctionKind
  lines.push(`export enum FunctionKind {`)
  for (const [key, value] of Object.entries(functionKinds)) {
    lines.push(`  ${key} = ${value},`)
  }
  lines.push(`}`)
  lines.push(``)

  // JSMode
  lines.push(`export enum JSMode {`)
  for (const [key, value] of Object.entries(jsModes)) {
    lines.push(`  ${key} = ${value},`)
  }
  lines.push(`}`)
  lines.push(``)

  // PC2Line
  lines.push(`export enum PC2Line {`)
  for (const [key, value] of Object.entries(pc2LineCodes)) {
    lines.push(`  ${key} = ${value},`)
  }
  lines.push(`}`)
  lines.push(``)

  // OPSpecialObjectEnum
  lines.push(`export enum OPSpecialObjectEnum {`)
  for (const [key, value] of Object.entries(specialObjects)) {
    lines.push(`  ${key} = ${value},`)
  }
  lines.push(`}`)
  lines.push(``)

  // OpFormat
  lines.push(`export enum OpFormat {`)
  for (const [key, value] of Object.entries(opFormats)) {
    lines.push(`  ${key} = ${value},`)
  }
  lines.push(`}`)
  lines.push(``)

  // Opcode Enum (只包含最终字节码中的 opcodes)
  const finalOpcodes = opcodes.filter(op => !op.isTemp)
  const tempOpcodes = opcodes.filter(op => op.isTemp)

  // 额外常量（用于与 QuickJS parser.c 输出逐字节对齐）
  // 说明：这些常量/函数不是从 WASM 导出获取，而是为了在 TS 侧复用 QuickJS 的编码公式，减少魔数散落。
  // QuickJS 源码出处：third_party/QuickJS/src/core/parser.c
  // - 赋值 rest 属性：emit_u8(s, 0 | ((depth_lvalue + 1) << 2) | ((depth_lvalue + 2) << 5));
  //   （位于处理 `{...rest}` / `...rest` 的 copy_data_properties 路径）
  lines.push(`// copy_data_properties flags 编码（对齐 QuickJS parser.c 的 emit_u8 公式）`)
  lines.push(`export const TEMP_OPCODE_MIN = ${Math.min(...tempOpcodes.map(o => o.code))}`)
  lines.push(`export const TEMP_OPCODE_MAX = ${Math.max(...tempOpcodes.map(o => o.code))}`)
  lines.push(`export function encodeCopyDataPropertiesFlags(depthLValue: number): number {`)
  lines.push(`  return 0 | ((depthLValue + 1) << 2) | ((depthLValue + 2) << 5)`)
  lines.push(`}`)
  lines.push(`export const COPY_DATA_PROPERTIES_FLAGS_DEPTH0 = encodeCopyDataPropertiesFlags(0)`)
  lines.push(``)
  lines.push(`// OP_copy_data_properties 的 u8 操作数编码（对齐 QuickJS parser.c）`)
  lines.push(`// - 对象字面量展开 { ...obj }：parser.c:2947-2952`)
  lines.push(`// - 解构 rest 属性 {a, ...rest}：parser.c:4386-4388`)
  lines.push(`export const COPY_DATA_PROPERTIES_EXCLUDE_FIRST_SHIFT = ${2}`)
  lines.push(`export const COPY_DATA_PROPERTIES_EXCLUDE_SECOND_SHIFT = ${5}`)
  lines.push(`export function encodeCopyDataPropertiesOperand(copyFlags: number, excludeFirstIdx: number, excludeSecondIdx: number): number {`)
  lines.push(`  return (copyFlags & 0x03) | ((excludeFirstIdx & 0x07) << COPY_DATA_PROPERTIES_EXCLUDE_FIRST_SHIFT) | ((excludeSecondIdx & 0x07) << COPY_DATA_PROPERTIES_EXCLUDE_SECOND_SHIFT)`)
  lines.push(`}`)
  lines.push(`// QuickJS object spread: emit_u8(s, 2 | (1 << 2) | (0 << 5));`)
  lines.push(`export const COPY_DATA_PROPERTIES_OPERAND_SPREAD = encodeCopyDataPropertiesOperand(${2}, ${1}, ${0})`)
  lines.push(``)
  
  lines.push(`export enum Opcode {`)
  for (const op of finalOpcodes) {
    lines.push(`  OP_${op.name} = ${op.code},`)
  }
  lines.push(`}`)
  lines.push(``)

  // TempOpcode Enum (临时 opcodes，只在编译阶段使用，ID 与 SHORT_OPCODES 重叠)
  lines.push(`// 临时 opcodes: 只在编译阶段使用，ID 与 SHORT_OPCODES 重叠，最终字节码中不会出现`)
  lines.push(`export enum TempOpcode {`)
  for (const op of tempOpcodes) {
    lines.push(`  OP_${op.name} = ${op.code},`)
  }
  lines.push(`}`)
  lines.push(``)

  // OPCODE_NAME_TO_CODE (只包含最终 opcodes)
  lines.push(`export const OPCODE_NAME_TO_CODE: Record<string, number> = {`)
  for (const op of finalOpcodes) {
    lines.push(`  "${op.name}": ${op.code},`)
  }
  lines.push(`}`)
  lines.push(``)

  // TEMP_OPCODE_NAME_TO_CODE (临时 opcodes，用于编译阶段)
  lines.push(`// 临时 opcodes: 只在编译阶段使用，ID 与 SHORT_OPCODES 重叠`)
  lines.push(`export const TEMP_OPCODE_NAME_TO_CODE: Record<string, number> = {`)
  for (const op of tempOpcodes) {
    lines.push(`  "${op.name}": ${op.code},`)
  }
  lines.push(`}`)
  lines.push(``)

  // JSAtom Enum (Static Atoms)
  lines.push(`export enum JSAtom {`)
  const atomEnumNames = new Map<number, string>()
  const atomStrings = new Map<number, string>()

  for (const atom of atoms) {
    // For Enum: use the first name seen for an ID (which is the identifier)
    if (!atomEnumNames.has(atom.id)) {
      atomEnumNames.set(atom.id, atom.key)
    }
    // For Strings: use the last name seen for an ID (which is the string value)
    atomStrings.set(atom.id, atom.key)
  }

  for (const [id, key] of atomEnumNames) {
    if (key === 'empty_string') {
      lines.push(`  JS_ATOM_empty_string = ${id},`)
    } else if (key === '<private_brand>') {
      lines.push(`  JS_ATOM_Private_brand = ${id},`)
    } else {
      lines.push(`  JS_ATOM_${key} = ${id},`)
    }
  }
  lines.push(`}`)
  lines.push(``)

  // ATOM_STRINGS (Static Atoms)
  lines.push(`export const ATOM_STRINGS: Record<number, string> = {`)
  for (const [id, key] of atomStrings) {
    if (key === 'empty_string') {
      lines.push(`  ${id}: "",`)
    } else if (key === '<private_brand>') {
      // QuickJS quickjs-atom.h: DEF(Private_brand, "<brand>")
      lines.push(`  ${id}: "<brand>",`)
    } else {
      lines.push(`  ${id}: "${key}",`)
    }
  }
  lines.push(`}`)
  lines.push(``)

  // OpcodeDefinition
  lines.push(`export interface OpcodeDefinition {`)
  lines.push(`  id: string`)
  lines.push(`  size: number`)
  lines.push(`  nPop: number`)
  lines.push(`  nPush: number`)
  lines.push(`  format: OpFormat`)
  lines.push(`}`)
  lines.push(``)

  // OPCODE_DEFS - 按名称索引 (只包含最终 opcodes)
  lines.push(`export const OPCODE_DEFS: Record<string, OpcodeDefinition> = {`)
  const fmtMap = new Map(Object.entries(opFormats).map(([k, v]) => [v, k]))
  for (const op of finalOpcodes) {
    const fmtName = fmtMap.get(op.fmt) || 'none'
    lines.push(`  OP_${op.name}: { id: "${op.name}", size: ${op.size}, nPop: ${op.nPop}, nPush: ${op.nPush}, format: OpFormat.${fmtName} },`)
  }
  lines.push(`}`)
  lines.push(``)

  // OPCODE_BY_CODE - 按数字索引（用于 VariableResolver）(只包含最终 opcodes)
  lines.push(`export const OPCODE_BY_CODE: Record<number, OpcodeDefinition> = {`)
  for (const op of finalOpcodes) {
    const fmtName = fmtMap.get(op.fmt) || 'none'
    lines.push(`  ${op.code}: { id: "${op.name}", size: ${op.size}, nPop: ${op.nPop}, nPush: ${op.nPush}, format: OpFormat.${fmtName} },`)
  }
  lines.push(`}`)
  lines.push(``)

  // TEMP_OPCODE_DEFS - 临时 opcodes (用于编译阶段)
  lines.push(`// 临时 opcodes: 只在编译阶段使用，不会出现在最终字节码中`)
  lines.push(`export const TEMP_OPCODE_DEFS: Record<string, OpcodeDefinition> = {`)
  for (const op of tempOpcodes) {
    const fmtName = fmtMap.get(op.fmt) || 'none'
    lines.push(`  OP_${op.name}: { id: "${op.name}", size: ${op.size}, nPop: ${op.nPop}, nPush: ${op.nPush}, format: OpFormat.${fmtName} },`)
  }
  lines.push(`}`)
  lines.push(``)

  // TEMP_OPCODE_BY_CODE - 按数字索引的临时 opcodes（用于 VariableResolver）
  lines.push(`export const TEMP_OPCODE_BY_CODE: Record<number, OpcodeDefinition> = {`)
  for (const op of tempOpcodes) {
    const fmtName = fmtMap.get(op.fmt) || 'none'
    lines.push(`  ${op.code}: { id: "${op.name}", size: ${op.size}, nPop: ${op.nPop}, nPush: ${op.nPush}, format: OpFormat.${fmtName} },`)
  }
  lines.push(`}`)
  lines.push(``)

  // SHORT_OPCODE_DEFS - 保持兼容性
  lines.push(`export const SHORT_OPCODE_DEFS: Record<string, OpcodeDefinition> = {`)
  for (const op of finalOpcodes) {
     const fmtName = fmtMap.get(op.fmt) || 'none'
     lines.push(`  OP_${op.name}: { id: "${op.name}", size: ${op.size}, nPop: ${op.nPop}, nPush: ${op.nPush}, format: OpFormat.${fmtName} },`)
  }
  lines.push(`}`)
  lines.push(``)

  // Env Interface
  lines.push(`export interface Env {`)
  lines.push(`  bytecodeVersion: number`)
  lines.push(`  compileOptions: number`)
  lines.push(`  firstAtomId: number`)
  lines.push(`  supportsShortOpcodes: boolean`)
  lines.push(`  globalVarOffset: number`)
  lines.push(`  argumentVarOffset: number`)
  lines.push(`  argScopeIndex: number`)
  lines.push(`  argScopeEnd: number`)
  lines.push(`  debugScopeIndex: number`)
  lines.push(`  maxLocalVars: number`)
  lines.push(`  stackSizeMax: number`)
  lines.push(`}`)
  lines.push(``)

  // Env Constant
  lines.push(`export const env = {`)
  lines.push(`  bytecodeVersion: ${bytecodeVersion},`)
  lines.push(`  compileOptions: ${compileOptions},`)
  lines.push(`  firstAtomId: ${firstAtomId},`)
  lines.push(`  supportsShortOpcodes: true,`)
  lines.push(`  globalVarOffset: ${globalVarOffset},`)
  lines.push(`  argumentVarOffset: ${argumentVarOffset},`)
  lines.push(`  argScopeIndex: ${argScopeIndex},`)
  lines.push(`  argScopeEnd: ${argScopeEnd},`)
  lines.push(`  debugScopeIndex: ${debugScopeIndex},`)
  lines.push(`  maxLocalVars: ${maxLocalVars},`)
  lines.push(`  stackSizeMax: ${stackSizeMax},`)
  lines.push(`} as const`)
  lines.push(``)

  writeFileSync(envPath, lines.join('\n'))
  console.log(`Generated ${envPath}`)
}

main().catch(console.error)
