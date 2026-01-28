import type { BytecodeBuffer, JSValue } from './bytecode'

export type JSAtom = number

/**
 * @source parser.h: JSParseFunctionEnum
 */
export enum JSParseFunctionEnum {
  JS_PARSE_FUNC_STATEMENT,
  JS_PARSE_FUNC_VAR,
  JS_PARSE_FUNC_EXPR,
  JS_PARSE_FUNC_ARROW,
  JS_PARSE_FUNC_GETTER,
  JS_PARSE_FUNC_SETTER,
  JS_PARSE_FUNC_METHOD,
  JS_PARSE_FUNC_CLASS_STATIC_INIT,
  JS_PARSE_FUNC_CLASS_CONSTRUCTOR,
  JS_PARSE_FUNC_DERIVED_CLASS_CONSTRUCTOR,
}

/**
 * @source parser.h: JSParseExportEnum
 */
export enum JSParseExportEnum {
  JS_PARSE_EXPORT_NONE,
  JS_PARSE_EXPORT_NAMED,
  JS_PARSE_EXPORT_DEFAULT,
}

/**
 * @source types.h: JSVarKindEnum
 */
export enum JSVarKindEnum {
  JS_VAR_NORMAL,
  JS_VAR_FUNCTION_DECL,
  JS_VAR_NEW_FUNCTION_DECL,
  JS_VAR_CATCH,
  JS_VAR_FUNCTION_NAME,
  JS_VAR_PRIVATE_FIELD,
  JS_VAR_PRIVATE_METHOD,
  JS_VAR_PRIVATE_GETTER,
  JS_VAR_PRIVATE_SETTER,
  JS_VAR_PRIVATE_GETTER_SETTER,
}

/**
 * @source parser.h: RelocEntry
 */
export interface RelocEntry {
  next: RelocEntry | null
  addr: number
  size: number
}

/**
 * @source parser.h: JumpSlot
 */
export interface JumpSlot {
  op: number
  size: number
  pos: number
  label: number
}

/**
 * @source parser.h: LabelSlot
 */
export interface LabelSlot {
  refCount: number
  pos: number
  pos2: number
  addr: number
  firstReloc: RelocEntry | null
}

/**
 * @source parser.h: LineNumberSlot
 */
export interface LineNumberSlot {
  pc: number
  sourcePos: number
}

/**
 * @source parser.h: ColumnNumberSlot
 */
export interface ColumnNumberSlot {
  pc: number
  sourcePos: number
}

/**
 * @source types.h: JSClosureVar
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
 * @source types.h: JSVarScope
 */
export interface JSVarScope {
  parent: number
  first: number
}

/**
 * @source types.h: JSVarDef
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
 * @source parser.h: JSGlobalVar
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
 * @source parser.h: JSFunctionDef
 */
export interface JSFunctionDef {
  ctx: unknown
  parent: JSFunctionDef | null
  parentCpoolIdx: number
  parentScopeLevel: number

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
  bodyScope: number

  globalVarCount: number
  globalVarSize: number
  globalVars: JSGlobalVar[]

  byteCode: BytecodeBuffer
  lastOpcodePos: number
  lastOpcodeSourcePtr: number | null
  useShortOpcodes: boolean

  labelSlots: LabelSlot[]
  labelSize: number
  labelCount: number
  topBreak: unknown

  cpool: JSValue[]
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
  getLineColCache: unknown
  pc2line: BytecodeBuffer
  pc2column: BytecodeBuffer

  source: string | null
  sourceLen: number

  module: unknown
  hasAwait: boolean

  ic: unknown | null
}
