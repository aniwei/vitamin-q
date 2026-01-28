import type { JSAtom, JSVarDef, JSClosureVar } from './function-def'
import type { JSValue } from './bytecode'

/**
 * @source types.h: JSFunctionBytecode
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
  vardefs: JSVarDef[] | null
  closureVar: JSClosureVar[] | null

  argCount: number
  varCount: number
  definedArgCount: number
  stackSize: number

  realm: unknown
  cpool: JSValue[]
  cpoolCount: number
  closureVarCount: number

  ic: unknown | null

  debug: {
    filename: JSAtom
    sourceLen: number
    pc2lineLen: number
    pc2columnLen: number
    pc2lineBuf: Uint8Array | null
    pc2columnBuf: Uint8Array | null
    source: string | null
  }
}
