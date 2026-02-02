import type { JSAtom } from '../types/function-def'

export interface BCReaderState {
  buf: Uint8Array
  offset: number
}

/**
 * 字节码读取器（占位实现）。
 *
 * @source QuickJS/src/core/bytecode.cpp:320-460
 */
export const createReaderState = (buf: Uint8Array): BCReaderState => ({ buf, offset: 0 })

/**
 * @source QuickJS/src/core/bytecode.cpp:340-380
 * @see bc_get_u8
 */
export const bcGetU8 = (state: BCReaderState): number => state.buf[state.offset++] ?? 0

/**
 * @source QuickJS/src/core/bytecode.cpp:340-380
 * @see bc_get_u16
 */
export const bcGetU16 = (state: BCReaderState): number => {
  const b0 = bcGetU8(state)
  const b1 = bcGetU8(state)
  return b0 | (b1 << 8)
}

/**
 * @source QuickJS/src/core/bytecode.cpp:340-380
 * @see bc_get_u32
 */
export const bcGetU32 = (state: BCReaderState): number => {
  const b0 = bcGetU8(state)
  const b1 = bcGetU8(state)
  const b2 = bcGetU8(state)
  const b3 = bcGetU8(state)
  return (b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)) >>> 0
}

/**
 * @source QuickJS/src/core/bytecode.cpp:340-380
 * @see bc_get_u64
 */
export const bcGetU64 = (state: BCReaderState): bigint => {
  let value = 0n
  for (let i = 0; i < 8; i += 1) {
    value |= BigInt(bcGetU8(state)) << BigInt(8 * i)
  }
  return value
}

/**
 * @source QuickJS/src/core/bytecode.cpp:380-420
 * @see bc_get_leb128
 */
export const bcGetLeb128 = (state: BCReaderState): number => {
  let result = 0
  let shift = 0
  while (true) {
    const byte = bcGetU8(state)
    result |= (byte & 0x7f) << shift
    if ((byte & 0x80) === 0) break
    shift += 7
  }
  return result >>> 0
}

/**
 * @source QuickJS/src/core/bytecode.cpp:420-460
 * @see bc_get_sleb128
 */
export const bcGetSleb128 = (state: BCReaderState): number => {
  let result = 0
  let shift = 0
  let byte = 0
  do {
    byte = bcGetU8(state)
    result |= (byte & 0x7f) << shift
    shift += 7
  } while (byte & 0x80)

  if (shift < 32 && (byte & 0x40)) {
    result |= ~0 << shift
  }

  return result | 0
}

/**
 * @source QuickJS/src/core/bytecode.cpp:460-500
 * @see bc_get_atom
 */
export const bcGetAtom = (state: BCReaderState, idxToAtom: JSAtom[]): JSAtom => {
  const idx = bcGetU32(state)
  return idxToAtom[idx] ?? 0
}
