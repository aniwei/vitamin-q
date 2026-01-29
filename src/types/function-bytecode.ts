import type { ConstantPool } from './bytecode'
import type { JSAtom, JSClosureVar, JSVarDef, JSVarKindEnum, JSContext, InlineCache } from './function-def'

/**
 * JSFunctionBytecode 结构（执行期字节码）。
 *
 * @source QuickJS/src/core/types.h:250-330
 */
export interface JSFunctionBytecode {
  header: unknown
  jsMode: number
  hasPrototype: boolean
  hasSimpleParameterList: boolean
  isDerivedClassConstructor: boolean
  needHomeObject: boolean
  funcKind: number
  newTargetAllowed: boolean
  superCallAllowed: boolean
  superAllowed: boolean
  argumentsAllowed: boolean
  hasDebug: boolean
  readOnlyBytecode: boolean
  isDirectOrIndirectEval: boolean
  byteCodeBuf: Uint8Array
  byteCodeLen: number
  funcName: JSAtom
  vardefs: JSVarDef[]
  closureVar: JSClosureVar[]
  argCount: number
  varCount: number
  definedArgCount: number
  stackSize: number
  realm: JSContext | null
  cpool: ConstantPool
  cpoolCount: number
  closureVarCount: number
  ic: InlineCache | null
  debug: {
    filename: JSAtom
    sourceLen: number
    pc2lineLen: number
    pc2columnLen: number
    pc2lineBuf: Uint8Array
    pc2columnBuf: Uint8Array
    source: string | null
  }
}

/**
 * 运行期变量定义（用于 JSFunctionBytecode）。
 *
 * @source QuickJS/src/core/function.c:8600-8800
 */
export interface JSFunctionVarDef {
  varName: JSAtom
  scopeLevel: number
  scopeNext: number
  isConst: boolean
  isLexical: boolean
  isCaptured: boolean
  varKind: JSVarKindEnum
}

/**
 * JSFunctionBytecode 中的 vardef 聚合。
 *
 * @source QuickJS/src/core/bytecode.cpp:620-760
 */
export interface JSFunctionVarDefs {
  argCount: number
  varCount: number
  vardefs: JSFunctionVarDef[]
}

/**
 * JSFunctionBytecode 中的调试信息。
 *
 * @source QuickJS/src/core/bytecode.cpp:760-880
 */
export interface JSFunctionDebugInfo {
  filename: JSAtom
  pc2lineBuf: Uint8Array
}

/**
 * JSFunctionBytecode 中的源代码信息。
 *
 * @source QuickJS/src/core/bytecode.cpp:880-940
 */
export interface JSFunctionSourceInfo {
  source: string
  sourceLen: number
}

/**
 * JSFunctionBytecode 中的闭包变量聚合。
 *
 * @source QuickJS/src/core/bytecode.cpp:480-620
 */
export interface JSFunctionClosureInfo {
  closureVarCount: number
  closureVar: JSClosureVar[]
}

/**
 * JSFunctionBytecode 标志位。
 *
 * @source QuickJS/src/core/bytecode.cpp:430-470
 */
export interface JSFunctionBytecodeFlags {
  hasDebug: boolean
  readOnlyBytecode: boolean
  isDirectOrIndirectEval: boolean
}

/**
 * JSFunctionBytecode 的序列化视图。
 *
 * @source QuickJS/src/core/bytecode.cpp:430-940
 */
export interface JSFunctionBytecodeView {
  flags: JSFunctionBytecodeFlags
  byteCode: Uint8Array
  cpool: ConstantPool
  vardefs: JSFunctionVarDefs
  closure: JSFunctionClosureInfo
  debug: JSFunctionDebugInfo | null
  source: JSFunctionSourceInfo | null
}
