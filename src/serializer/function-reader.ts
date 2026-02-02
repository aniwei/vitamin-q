import type { JSFunctionBytecodeFlags, JSFunctionBytecodeView } from '../types/function-bytecode'
import { bcGetLeb128, bcGetU32, bcGetU8 } from './bytecode-reader'
import type { JSAtom } from '../types/function-def'

/**
 * 函数字节码反序列化（占位实现）。
 *
 * @source QuickJS/src/core/bytecode.cpp:760-900
 */
export const JS_ReadFunctionTag = (
  reader: { buf: Uint8Array; offset: number },
  idxToAtom: JSAtom[],
): JSFunctionBytecodeView => {
  const flagsValue = bcGetU32(reader)
  const flags: JSFunctionBytecodeFlags = {
    hasDebug: (flagsValue & (1 << 0)) !== 0,
    readOnlyBytecode: (flagsValue & (1 << 1)) !== 0,
    isDirectOrIndirectEval: (flagsValue & (1 << 2)) !== 0,
  }

  const byteCodeLen = bcGetLeb128(reader)
  const byteCode = new Uint8Array(byteCodeLen)
  for (let i = 0; i < byteCodeLen; i += 1) {
    byteCode[i] = bcGetU8(reader)
  }

  const argCount = bcGetLeb128(reader)
  const varCount = bcGetLeb128(reader)
  const vardefCount = bcGetLeb128(reader)

  const closureVarCount = bcGetLeb128(reader)

  const hasDebug = bcGetU8(reader) === 1
  let debug: { filename: JSAtom; pc2lineBuf: Uint8Array } | null = null
  if (hasDebug) {
    const pc2lineLen = bcGetLeb128(reader)
    const pc2lineBuf = new Uint8Array(pc2lineLen)
    for (let i = 0; i < pc2lineLen; i += 1) {
      pc2lineBuf[i] = bcGetU8(reader)
    }
    const filenameIdx = bcGetU32(reader)
    debug = {
      filename: idxToAtom[filenameIdx] ?? 0,
      pc2lineBuf,
    }
  }

  const hasSource = bcGetU8(reader) === 1
  const source = hasSource
    ? {
        source: '',
        sourceLen: bcGetLeb128(reader),
      }
    : null

  return {
    flags,
    byteCode,
    cpool: [],
    vardefs: {
      argCount,
      varCount,
      vardefs: new Array(vardefCount).fill(null).map(() => ({
        varName: 0,
        scopeLevel: 0,
        scopeNext: 0,
        isConst: false,
        isLexical: false,
        isCaptured: false,
        varKind: 0,
      })),
    },
    closure: {
      closureVarCount,
      closureVar: [],
    },
    debug: debug
      ? {
          filename: debug.filename,
          pc2lineBuf: debug.pc2lineBuf,
        }
      : null,
    source,
  }
}
