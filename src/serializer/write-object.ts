import { AtomTable } from '../atom/atom-table'
import {
  BytecodeTag,
  FIRST_ATOM_ID,
  FunctionKind,
  JSMode,
  JS_ATOM_NULL,
  OpFormat,
  OPCODE_BY_CODE,
  TEMP_OPCODE_BY_CODE,
} from '../env'
import type { JSAtom } from '../types/function-def'
import type { JSValue, ConstantPool } from '../types/bytecode'
import type { JSFunctionBytecodeView } from '../types/function-bytecode'
import type { ModuleParseResult } from '../module/module-parser'
import { bcPutLeb128, bcPutSleb128, bcPutU16, bcPutU32, bcPutU64, bcPutU8, createWriterState, toUint8Array } from './bytecode-writer'
import { decodeOperand, encodeOperand } from '../types/operand-format'

interface WriterState {
  atomTable: AtomTable
  atomToIndex: Map<JSAtom, number>
  indexToAtom: JSAtom[]
  firstAtom: number
  allowReference: boolean
  allowSAB: boolean
  allowBytecode: boolean
  objectList: object[]
}

export interface BytecodeSerializeOptions {
  atomTable: AtomTable
  bytecodeVersion: number
  allowReference?: boolean
  allowSAB?: boolean
  allowBytecode?: boolean
  functionMeta?: Partial<{
    jsMode: number
    funcName: JSAtom
    hasPrototype: boolean
    hasSimpleParameterList: boolean
    isDerivedClassConstructor: boolean
    needHomeObject: boolean
    funcKind: number
    newTargetAllowed: boolean
    superCallAllowed: boolean
    superAllowed: boolean
    argumentsAllowed: boolean
    definedArgCount: number
    stackSize: number
  }>
}

type WriteObjectValue =
  | JSValue
  | { kind: 'function'; view: JSFunctionBytecodeView; cpool: ConstantPool }
  | { kind: 'module'; view: ModuleParseResult; func: JSFunctionBytecodeView; cpool: ConstantPool }

const JS_ATOM_TAG_INT = 1 << 31

const isTaggedIntAtom = (atom: JSAtom): boolean => (atom & JS_ATOM_TAG_INT) !== 0
const atomToUInt32 = (atom: JSAtom): number => atom & ~JS_ATOM_TAG_INT

const createState = (options: BytecodeSerializeOptions): WriterState => ({
  atomTable: options.atomTable,
  atomToIndex: new Map(),
  indexToAtom: [],
  firstAtom: (options.allowBytecode ?? true) ? FIRST_ATOM_ID : 1,
  allowReference: options.allowReference ?? false,
  allowSAB: options.allowSAB ?? false,
  allowBytecode: options.allowBytecode ?? true,
  objectList: [],
})

const atomToIndex = (state: WriterState, atom: JSAtom): number => {
  if (atom < state.firstAtom || isTaggedIntAtom(atom)) return atom
  const existing = state.atomToIndex.get(atom)
  if (existing !== undefined) return existing
  const mapped = state.firstAtom + state.indexToAtom.length
  state.indexToAtom.push(atom)
  state.atomToIndex.set(atom, mapped)
  return mapped
}

const writeAtom = (writer: { buf: number[] }, state: WriterState, atom: JSAtom) => {
  if (isTaggedIntAtom(atom)) {
    bcPutLeb128(writer, (atomToUInt32(atom) << 1) | 1)
    return
  }
  const mapped = atomToIndex(state, atom)
  bcPutLeb128(writer, mapped << 1)
}

const getAtomName = (state: WriterState, atom: JSAtom): string => {
  if (atom === JS_ATOM_NULL) return ''
  return state.atomTable.getAtomName(atom) ?? ''
}

const hasWideChars = (value: string): boolean => {
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) > 0xff) return true
  }
  return false
}

const writeString = (writer: { buf: number[] }, value: string) => {
  const isWide = hasWideChars(value)
  bcPutLeb128(writer, (value.length << 1) | (isWide ? 1 : 0))
  if (isWide) {
    for (let i = 0; i < value.length; i += 1) {
      bcPutU16(writer, value.charCodeAt(i))
    }
    return
  }
  const bytes = new TextEncoder().encode(value)
  for (const byte of bytes) bcPutU8(writer, byte)
}

const writeStringAtom = (writer: { buf: number[] }, state: WriterState, atom: JSAtom) => {
  const name = getAtomName(state, atom)
  writeString(writer, name)
}

const bigintToTwosComplementBytes = (value: bigint): Uint8Array => {
  if (value === 0n) return new Uint8Array()

  const isNeg = value < 0n
  if (!isNeg) {
    let v = value
    const bytes: number[] = []
    while (v > 0n) {
      bytes.push(Number(v & 0xffn))
      v >>= 8n
    }
    if (bytes[bytes.length - 1] & 0x80) {
      bytes.push(0)
    }
    return Uint8Array.from(bytes)
  }

  const abs = -value
  const bitLen = abs.toString(2).length
  const isPow2 = (abs & (abs - 1n)) === 0n
  const width = isPow2 ? bitLen : bitLen + 1
  const mod = 1n << BigInt(width)
  let twos = mod + value
  const bytes: number[] = []
  const totalBytes = Math.ceil(width / 8)
  for (let i = 0; i < totalBytes; i += 1) {
    bytes.push(Number(twos & 0xffn))
    twos >>= 8n
  }
  while (bytes.length > 1 && bytes[bytes.length - 1] === 0xff && (bytes[bytes.length - 2] & 0x80)) {
    bytes.pop()
  }
  return Uint8Array.from(bytes)
}

const rewriteBytecodeAtoms = (state: WriterState, bytecode: Uint8Array): Uint8Array => {
  const out = new Uint8Array(bytecode.length)
  let pos = 0
  while (pos < bytecode.length) {
    const opcode = bytecode[pos]
    const def = TEMP_OPCODE_BY_CODE[opcode] ?? OPCODE_BY_CODE[opcode]
    if (!def) throw new Error(`Unknown opcode: ${opcode}`)
    out[pos] = opcode
    const size = def.size
    if (size > 1) {
      const slice = bytecode.slice(pos + 1, pos + size)
      out.set(slice, pos + 1)
      if (
        def.format === OpFormat.atom ||
        def.format === OpFormat.atom_u8 ||
        def.format === OpFormat.atom_u16 ||
        def.format === OpFormat.atom_label_u8 ||
        def.format === OpFormat.atom_label_u16
      ) {
        const values = decodeOperand(def.format, bytecode.buffer, bytecode.byteOffset + pos + 1)
        if (values.length > 0) {
          values[0] = atomToIndex(state, values[0] as JSAtom)
          encodeOperand(def.format, out.buffer, out.byteOffset + pos + 1, values)
        }
      }
    }
    pos += size
  }
  return out
}

const writeFunctionTag = (
  writer: { buf: number[] },
  state: WriterState,
  view: JSFunctionBytecodeView,
  options: BytecodeSerializeOptions,
) => {
  bcPutU8(writer, BytecodeTag.TC_TAG_FUNCTION_BYTECODE)

  const meta = options.functionMeta ?? {}
  const flags = (() => {
    let value = 0
    let idx = 0
    const set = (v: number, bits: number) => {
      value |= (v & ((1 << bits) - 1)) << idx
      idx += bits
    }
    set(meta.hasPrototype ? 1 : 0, 1)
    set(meta.hasSimpleParameterList ?? 1, 1)
    set(meta.isDerivedClassConstructor ? 1 : 0, 1)
    set(meta.needHomeObject ? 1 : 0, 1)
    set(meta.funcKind ?? FunctionKind.JS_FUNC_NORMAL, 2)
    set(meta.newTargetAllowed ? 1 : 0, 1)
    set(meta.superCallAllowed ? 1 : 0, 1)
    set(meta.superAllowed ? 1 : 0, 1)
    set(meta.argumentsAllowed ?? 1, 1)
    set(view.flags.hasDebug ? 1 : 0, 1)
    set(view.flags.isDirectOrIndirectEval ? 1 : 0, 1)
    return value
  })()

  bcPutU16(writer, flags)
  bcPutU8(writer, meta.jsMode ?? JSMode.JS_MODE_STRICT)
  writeAtom(writer, state, meta.funcName ?? JS_ATOM_NULL)

  const definedArgCount = meta.definedArgCount ?? view.vardefs.argCount
  bcPutLeb128(writer, view.vardefs.argCount)
  bcPutLeb128(writer, view.vardefs.varCount)
  bcPutLeb128(writer, definedArgCount)
  bcPutLeb128(writer, meta.stackSize ?? 0)
  bcPutLeb128(writer, view.closure.closureVarCount)
  bcPutLeb128(writer, view.cpool.length)
  bcPutLeb128(writer, view.byteCode.length)

  if (view.vardefs.vardefs.length > 0) {
    bcPutLeb128(writer, view.vardefs.argCount + view.vardefs.varCount)
    for (const def of view.vardefs.vardefs) {
      writeAtom(writer, state, def.varName)
      bcPutLeb128(writer, def.scopeLevel)
      bcPutLeb128(writer, def.scopeNext + 1)
      let varFlags = 0
      let idx = 0
      const set = (v: number, bits: number) => {
        varFlags |= (v & ((1 << bits) - 1)) << idx
        idx += bits
      }
      set(def.varKind, 4)
      set(def.isConst ? 1 : 0, 1)
      set(def.isLexical ? 1 : 0, 1)
      set(def.isCaptured ? 1 : 0, 1)
      bcPutU8(writer, varFlags)
    }
  } else {
    bcPutLeb128(writer, 0)
  }

  for (const closureVar of view.closure.closureVar) {
    writeAtom(writer, state, closureVar.varName)
    bcPutLeb128(writer, closureVar.varIdx)
    let cvFlags = 0
    let idx = 0
    const set = (v: number, bits: number) => {
      cvFlags |= (v & ((1 << bits) - 1)) << idx
      idx += bits
    }
    set(closureVar.isLocal ? 1 : 0, 1)
    set(closureVar.isArg ? 1 : 0, 1)
    set(closureVar.isConst ? 1 : 0, 1)
    set(closureVar.isLexical ? 1 : 0, 1)
    set(closureVar.varKind ?? 0, 4)
    bcPutU8(writer, cvFlags)
  }

  const rewritten = rewriteBytecodeAtoms(state, view.byteCode)
  for (const byte of rewritten) bcPutU8(writer, byte)

  if (view.flags.hasDebug && view.debug) {
    writeAtom(writer, state, view.debug.filename)
    bcPutLeb128(writer, view.debug.pc2lineBuf.length)
    for (const byte of view.debug.pc2lineBuf) bcPutU8(writer, byte)
    bcPutLeb128(writer, 0)
  }

  for (const value of view.cpool) {
    writeObjectRec(writer, state, value)
  }
}

const writeModuleTag = (
  writer: { buf: number[] },
  state: WriterState,
  module: ModuleParseResult,
  func: JSFunctionBytecodeView,
  options: BytecodeSerializeOptions,
) => {
  bcPutU8(writer, BytecodeTag.TC_TAG_MODULE)
  writeAtom(writer, state, module.moduleName)

  bcPutLeb128(writer, module.entries.reqModuleEntries.length)
  for (const entry of module.entries.reqModuleEntries) {
    writeAtom(writer, state, entry.moduleName)
    writeObjectRec(writer, state, entry.attributes)
  }

  bcPutLeb128(writer, module.entries.exportEntries.length)
  for (const entry of module.entries.exportEntries) {
    bcPutU8(writer, entry.exportType)
    if ('local' in entry.u) {
      bcPutLeb128(writer, entry.u.local.varIdx)
    } else {
      bcPutLeb128(writer, entry.u.reqModuleIdx)
      writeAtom(writer, state, entry.localName)
    }
    writeAtom(writer, state, entry.exportName)
  }

  bcPutLeb128(writer, module.entries.starExportEntries.length)
  for (const entry of module.entries.starExportEntries) {
    bcPutLeb128(writer, entry.reqModuleIdx)
  }

  bcPutLeb128(writer, module.entries.importEntries.length)
  for (const entry of module.entries.importEntries) {
    bcPutLeb128(writer, entry.varIdx)
    bcPutU8(writer, entry.isStar ? 1 : 0)
    writeAtom(writer, state, entry.importName)
    bcPutLeb128(writer, entry.reqModuleIdx)
  }

  bcPutU8(writer, 0)
  writeFunctionTag(writer, state, func, options)
}

const writeObjectRec = (writer: { buf: number[] }, state: WriterState, value: WriteObjectValue) => {
  if (value === null) {
    bcPutU8(writer, BytecodeTag.TC_TAG_NULL)
    return
  }
  if (value === undefined) {
    bcPutU8(writer, BytecodeTag.TC_TAG_UNDEFINED)
    return
  }
  if (typeof value === 'boolean') {
    bcPutU8(writer, value ? BytecodeTag.TC_TAG_BOOL_TRUE : BytecodeTag.TC_TAG_BOOL_FALSE)
    return
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value) && value >= -2147483648 && value <= 2147483647) {
      bcPutU8(writer, BytecodeTag.TC_TAG_INT32)
      bcPutSleb128(writer, value)
      return
    }
    bcPutU8(writer, BytecodeTag.TC_TAG_FLOAT64)
    const buffer = new ArrayBuffer(8)
    new DataView(buffer).setFloat64(0, value, true)
    const bytes = new Uint8Array(buffer)
    for (const byte of bytes) bcPutU8(writer, byte)
    return
  }
  if (typeof value === 'string') {
    bcPutU8(writer, BytecodeTag.TC_TAG_STRING)
    writeString(writer, value)
    return
  }
  if (typeof value === 'bigint') {
    bcPutU8(writer, BytecodeTag.TC_TAG_BIG_INT)
    const bytes = bigintToTwosComplementBytes(value)
    bcPutLeb128(writer, bytes.length)
    for (const byte of bytes) bcPutU8(writer, byte)
    return
  }
  if (Array.isArray(value)) {
    bcPutU8(writer, BytecodeTag.TC_TAG_ARRAY)
    bcPutLeb128(writer, value.length)
    for (const item of value) {
      writeObjectRec(writer, state, item)
    }
    return
  }
  if (typeof value === 'object') {
    if ('kind' in value && value.kind === 'function' && (value as { view?: JSFunctionBytecodeView }).view) {
      writeFunctionTag(writer, state, (value as { view: JSFunctionBytecodeView }).view, {
        atomTable: state.atomTable,
        bytecodeVersion: 0,
      })
      return
    }
    if (
      'kind' in value &&
      value.kind === 'module' &&
      (value as { view?: ModuleParseResult; func?: JSFunctionBytecodeView }).view &&
      (value as { view?: ModuleParseResult; func?: JSFunctionBytecodeView }).func
    ) {
      const typed = value as { view: ModuleParseResult; func: JSFunctionBytecodeView }
      writeModuleTag(writer, state, typed.view, typed.func, {
        atomTable: state.atomTable,
        bytecodeVersion: 0,
      })
      return
    }

    if (state.allowReference) {
      const existing = state.objectList.indexOf(value as object)
      if (existing >= 0) {
        bcPutU8(writer, BytecodeTag.TC_TAG_OBJECT_REFERENCE)
        bcPutLeb128(writer, existing)
        return
      }
      state.objectList.push(value as object)
    }
    bcPutU8(writer, BytecodeTag.TC_TAG_OBJECT)
    const entries = Object.entries(value as Record<string, JSValue>)
    bcPutLeb128(writer, entries.length)
    for (const [key, entry] of entries) {
      const atom = state.atomTable.getOrAdd(key)
      writeAtom(writer, state, atom)
      writeObjectRec(writer, state, entry)
    }
    return
  }
  throw new Error('unsupported JS value in serialization')
}

const buildAtomsSection = (state: WriterState, version: number) => {
  const writer = createWriterState()
  bcPutU8(writer, version)
  bcPutLeb128(writer, state.indexToAtom.length)
  for (const atom of state.indexToAtom) {
    writeStringAtom(writer, state, atom)
  }
  return toUint8Array(writer)
}

export const serializeBytecodeObject = (
  view: JSFunctionBytecodeView,
  options: BytecodeSerializeOptions,
  module?: ModuleParseResult | null,
): Uint8Array => {
  const state = createState(options)
  const writer = createWriterState()

  if (module) {
    writeModuleTag(writer, state, module, view, options)
  } else {
    writeFunctionTag(writer, state, view, options)
  }

  const objectBytes = toUint8Array(writer)
  const atomsBytes = buildAtomsSection(state, options.bytecodeVersion)
  const output = new Uint8Array(atomsBytes.length + objectBytes.length)
  output.set(atomsBytes, 0)
  output.set(objectBytes, atomsBytes.length)
  return output
}