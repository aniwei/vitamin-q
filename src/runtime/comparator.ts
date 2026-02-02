export interface BytecodeDiff {
  match: boolean
  diffIndex?: number
  ours?: number
  wasm?: number
}

/**
 * 字节码对比（占位实现）。
 *
 * @source QuickJS/src/core/bytecode.cpp:1330-1400
 */
export const compareBytecode = (ours: Uint8Array, wasm: Uint8Array): BytecodeDiff => {
  const length = Math.max(ours.length, wasm.length)
  for (let i = 0; i < length; i += 1) {
    if (ours[i] !== wasm[i]) {
      return { match: false, diffIndex: i, ours: ours[i], wasm: wasm[i] }
    }
  }
  return { match: true }
}
