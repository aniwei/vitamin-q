export interface BCWriterState {
  buf: number[]
}

/**
 * 字节码写入器（占位实现）。
 *
 * @source QuickJS/src/core/bytecode.cpp:60-220
 */
export const createWriterState = (): BCWriterState => ({ buf: [] })

/**
 * @source QuickJS/src/core/bytecode.cpp:90-140
 * @see bc_put_u8
 */
export const bcPutU8 = (state: BCWriterState, value: number) => {
  state.buf.push(value & 0xff)
}

/**
 * @source QuickJS/src/core/bytecode.cpp:90-140
 * @see bc_put_u16
 */
export const bcPutU16 = (state: BCWriterState, value: number) => {
  bcPutU8(state, value)
  bcPutU8(state, value >> 8)
}

/**
 * @source QuickJS/src/core/bytecode.cpp:90-140
 * @see bc_put_u32
 */
export const bcPutU32 = (state: BCWriterState, value: number) => {
  bcPutU8(state, value)
  bcPutU8(state, value >> 8)
  bcPutU8(state, value >> 16)
  bcPutU8(state, value >> 24)
}

/**
 * @source QuickJS/src/core/bytecode.cpp:90-140
 * @see bc_put_u64
 */
export const bcPutU64 = (state: BCWriterState, value: number | bigint) => {
  let v = typeof value === 'bigint' ? value : BigInt(value)
  for (let i = 0; i < 8; i += 1) {
    bcPutU8(state, Number(v & 0xffn))
    v >>= 8n
  }
}

/**
 * @source QuickJS/src/core/bytecode.cpp:140-190
 * @see bc_put_leb128
 */
export const bcPutLeb128 = (state: BCWriterState, value: number) => {
  let v = value >>> 0
  while (v >= 0x80) {
    bcPutU8(state, (v & 0x7f) | 0x80)
    v >>>= 7
  }
  bcPutU8(state, v)
}

/**
 * @source QuickJS/src/core/bytecode.cpp:190-220
 * @see bc_put_sleb128
 */
export const bcPutSleb128 = (state: BCWriterState, value: number) => {
  let v = value | 0
  let more = true
  while (more) {
    const byte = v & 0x7f
    v >>= 7
    const signBit = byte & 0x40
    more = !((v === 0 && signBit === 0) || (v === -1 && signBit !== 0))
    bcPutU8(state, more ? byte | 0x80 : byte)
  }
}

/**
 * @source QuickJS/src/core/bytecode.cpp:220-260
 * @see bc_set_flags
 */
export const bcSetFlags = (value: number, flag: number, enabled: boolean): number =>
  (enabled ? value | flag : value & ~flag)

/**
 * @source QuickJS/src/core/bytecode.cpp:260-320
 * @see bc_byte_swap
 */
export const bcByteSwap = (buf: Uint8Array, wordSize = 4): Uint8Array => {
  const out = Uint8Array.from(buf)
  for (let i = 0; i < out.length; i += wordSize) {
    for (let j = 0; j < wordSize / 2; j += 1) {
      const left = i + j
      const right = i + wordSize - 1 - j
      if (right >= out.length) continue
      const tmp = out[left]
      out[left] = out[right]
      out[right] = tmp
    }
  }
  return out
}

export const toUint8Array = (state: BCWriterState): Uint8Array => Uint8Array.from(state.buf)
