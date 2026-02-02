import type { JSFunctionBytecodeFlags, JSFunctionBytecodeView } from '../types/function-bytecode'
import { bcPutLeb128, bcPutU32, bcPutU8, bcSetFlags } from './bytecode-writer'
import { bcPutAtom, type AtomWriteState } from './atom-writer'

/**
 * 函数字节码序列化（占位实现）。
 *
 * @source QuickJS/src/core/bytecode.cpp:620-760
 */
export const JS_WriteFunctionTag = (
  writer: { buf: number[] },
  atomState: AtomWriteState,
  view: JSFunctionBytecodeView,
) => {
  let flags = 0
  flags = bcSetFlags(flags, 1 << 0, view.flags.hasDebug)
  flags = bcSetFlags(flags, 1 << 1, view.flags.readOnlyBytecode)
  flags = bcSetFlags(flags, 1 << 2, view.flags.isDirectOrIndirectEval)
  bcPutU32(writer, flags)

  bcPutLeb128(writer, view.byteCode.length)
  for (const byte of view.byteCode) bcPutU8(writer, byte)

  bcPutLeb128(writer, view.vardefs.argCount)
  bcPutLeb128(writer, view.vardefs.varCount)
  bcPutLeb128(writer, view.vardefs.vardefs.length)

  bcPutLeb128(writer, view.closure.closureVarCount)

  if (view.debug) {
    bcPutU8(writer, 1)
    bcPutLeb128(writer, view.debug.pc2lineBuf.length)
    for (const byte of view.debug.pc2lineBuf) bcPutU8(writer, byte)
    bcPutAtom(atomState, writer, view.debug.filename)
  } else {
    bcPutU8(writer, 0)
  }

  if (view.source) {
    bcPutU8(writer, 1)
    bcPutLeb128(writer, view.source.sourceLen)
  } else {
    bcPutU8(writer, 0)
  }
}

export const buildFunctionFlags = (flags: JSFunctionBytecodeFlags) => ({
  hasDebug: flags.hasDebug,
  readOnlyBytecode: flags.readOnlyBytecode,
  isDirectOrIndirectEval: flags.isDirectOrIndirectEval,
})
