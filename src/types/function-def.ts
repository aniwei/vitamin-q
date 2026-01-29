import type { BytecodeBuffer, ConstantPool } from './bytecode'
import type { JSModuleDef } from './module'
import {
  JSParseExportEnum,
  JSParseFunctionEnum,
  JSVarKindEnum,
} from '../env'

/**
 * JSAtom 类型占位。
 *
 * @source QuickJS/include/QuickJS/quickjs.h:220-260
 */
export type JSAtom = number

/**
 * JSContext 类型占位。
 *
 * @source QuickJS/src/core/types.h:150-230
 */
export interface JSContext {}


/**
 * InlineCache 类型占位。
 *
 * @source QuickJS/src/core/runtime.h:310-420
 */
export interface InlineCache {}

/**
 * BlockEnv 结构。
 *
 * @source QuickJS/src/core/parser.h:120-150
 */
export interface BlockEnv {
  prev: BlockEnv | null
  labelName: JSAtom
  labelBreak: number
  labelCont: number
  dropCount: number
  labelFinally: number
  scopeLevel: number
  hasIterator: boolean
  isRegularStmt: boolean
}

/**
 * JSGlobalVar 结构。
 *
 * @source QuickJS/src/core/parser.h:153-170
 */
export interface JSGlobalVar {
  cpoolIdx: number
  forceInit: boolean
  isLexical: boolean
  isConst: boolean
  scopeLevel: number
  varName: JSAtom
}

/**
 * RelocEntry 结构。
 *
 * @source QuickJS/src/core/parser.h:172-177
 */
export interface RelocEntry {
  next: RelocEntry | null
  addr: number
  size: number
}

/**
 * JumpSlot 结构。
 *
 * @source QuickJS/src/core/parser.h:179-183
 */
export interface JumpSlot {
  op: number
  size: number
  pos: number
  label: number
}

/**
 * LabelSlot 结构。
 *
 * @source QuickJS/src/core/parser.h:185-191
 */
export interface LabelSlot {
  refCount: number
  pos: number
  pos2: number
  addr: number
  firstReloc: RelocEntry | null
}

/**
 * LineNumberSlot 结构。
 *
 * @source QuickJS/src/core/parser.h:193-196
 */
export interface LineNumberSlot {
  pc: number
  sourcePos: number
}

/**
 * ColumnNumberSlot 结构。
 *
 * @source QuickJS/src/core/parser.h:198-201
 */
export interface ColumnNumberSlot {
  pc: number
  sourcePos: number
}

/**
 * GetLineColCache 结构。
 *
 * @source QuickJS/src/core/parser.h:203-210
 */
export interface GetLineColCache {
  ptr: Uint8Array | null
  lineNum: number
  colNum: number
  bufStart: Uint8Array | null
}

/**
 * JSParseFunctionEnum 枚举。
 *
 * @source QuickJS/src/core/parser.h:212-227
 */
export { JSParseFunctionEnum, JSParseExportEnum, JSVarKindEnum }

/**
 * JSClosureVar 结构。
 *
 * @source QuickJS/src/core/types.h:349-364
 */
export interface JSClosureVar {
  isLocal: boolean
  isArg: boolean
  isConst: boolean
  isLexical: boolean
  varKind: JSVarKindEnum
  varIdx: number
  varName: JSAtom
}

/**
 * JSVarScope 结构。
 *
 * @source QuickJS/src/core/types.h:366-371
 */
export interface JSVarScope {
  parent: number
  first: number
}

/**
 * JSVarDef 结构。
 *
 * @source QuickJS/src/core/types.h:388-422
 */
export interface JSVarDef {
  varName: JSAtom
  scopeLevel: number
  scopeNext: number
  isConst: boolean
  isLexical: boolean
  isCaptured: boolean
  isStaticPrivate: boolean
  varKind: JSVarKindEnum
  funcPoolIdx: number
}

/**
 * JSFunctionDef 结构（编译期函数定义）。
 *
 * @source QuickJS/src/core/parser.h:238-331
 */
export interface JSFunctionDef {
  ctx: JSContext
  parent: JSFunctionDef | null
  parentCpoolIdx: number
  parentScopeLevel: number
  childList: JSFunctionDef[]

  isEval: boolean
  evalType: number
  isGlobalVar: boolean
  isFuncExpr: boolean
  hasHomeObject: boolean
  hasPrototype: boolean
  hasSimpleParameterList: boolean
  hasParameterExpressions: boolean
  hasUseStrict: boolean
  hasEvalCall: boolean
  hasArgumentsBinding: boolean
  hasThisBinding: boolean
  newTargetAllowed: boolean
  superCallAllowed: boolean
  superAllowed: boolean
  argumentsAllowed: boolean
  isDerivedClassConstructor: boolean
  inFunctionBody: boolean
  funcKind: number
  funcType: JSParseFunctionEnum
  jsMode: number
  funcName: JSAtom

  vars: JSVarDef[]
  varSize: number
  varCount: number
  args: JSVarDef[]
  argSize: number
  argCount: number
  definedArgCount: number
  varObjectIdx: number
  argVarObjectIdx: number
  argumentsVarIdx: number
  argumentsArgIdx: number
  funcVarIdx: number
  evalRetIdx: number
  thisVarIdx: number
  newTargetVarIdx: number
  thisActiveFuncVarIdx: number
  homeObjectVarIdx: number
  needHomeObject: boolean

  scopeLevel: number
  scopeFirst: number
  scopeSize: number
  scopeCount: number
  scopes: JSVarScope[]
  defScopeArray: JSVarScope[]
  bodyScope: number

  globalVarCount: number
  globalVarSize: number
  globalVars: JSGlobalVar[]

  byteCode: BytecodeBuffer
  lastOpcodePos: number
  lastOpcodeSourcePtr: Uint8Array | null
  useShortOpcodes: boolean

  labelSlots: LabelSlot[]
  labelSize: number
  labelCount: number
  topBreak: BlockEnv | null

  cpool: ConstantPool
  cpoolCount: number
  cpoolSize: number

  closureVarCount: number
  closureVarSize: number
  closureVar: JSClosureVar[]

  jumpSlots: JumpSlot[]
  jumpSize: number
  jumpCount: number

  lineNumberSlots: LineNumberSlot[]
  lineNumberSize: number
  lineNumberCount: number
  lineNumberLast: number
  lineNumberLastPc: number

  columnNumberSlots: ColumnNumberSlot[]
  columnNumberSize: number
  columnNumberCount: number
  columnNumberLast: number
  columnNumberLastPc: number

  stripDebug: boolean
  stripSource: boolean
  filename: JSAtom
  sourcePos: number
  getLineColCache: GetLineColCache | null
  pc2line: BytecodeBuffer
  pc2column: BytecodeBuffer

  source: string | null
  sourceLen: number

  module: JSModuleDef | null
  hasAwait: boolean

  ic: InlineCache | null
}
