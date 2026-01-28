import { OPCODE_BY_CODE } from '../env'
import type { JSFunctionDef, LabelSlot } from '../types/function-def'

export interface LabelResolveResult {
  bytecode: Uint8Array
}

/**
 * 标签解析与优化（Phase 3）。
 *
 * @source parser.c: resolve_labels
 */
export const resolveLabels = (fd: JSFunctionDef): LabelResolveResult => {
  const bc = fd.byteCode.buf
  const out: number[] = []

  let pos = 0
  while (pos < bc.length) {
    const op = bc[pos]
    const size = OPCODE_BY_CODE[op]?.size ?? 1

    for (let i = 0; i < size; i += 1) {
      out.push(bc[pos + i] ?? 0)
    }

    pos += size
  }

  return { bytecode: Uint8Array.from(out) }
}

export const updateLabelAddr = (labelSlots: LabelSlot[], label: number, addr: number): void => {
  const slot = labelSlots[label]
  if (!slot) return
  slot.addr = addr
}
