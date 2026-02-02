import { Opcode, TempOpcode } from '../env'
import type { LabelSlot } from '../types/function-def'

const readU32 = (buffer: Uint8Array, offset: number): number => (
  buffer[offset] |
  (buffer[offset + 1] << 8) |
  (buffer[offset + 2] << 16) |
  (buffer[offset + 3] << 24)
) >>> 0

const writeU32 = (value: number): number[] => [
  value & 0xff,
  (value >>> 8) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 24) & 0xff,
]

const labelOps = new Set<number>([
  Opcode.OP_goto,
  Opcode.OP_if_true,
  Opcode.OP_if_false,
])

/**
 * 标签解析（将 label 索引替换为实际位置）。
 *
 * @source QuickJS/src/core/parser.c:1828-1889
 * @see emit_label
 * @see emit_goto
 */
export class LabelResolver {
  resolve(buffer: Uint8Array, slots: LabelSlot[]): Uint8Array {
    const labelPos = new Map<number, number>()
    for (let i = 0; i < slots.length; i += 1) {
      if (slots[i].pos >= 0) labelPos.set(i, slots[i].pos)
    }

    const out: number[] = []
    for (let i = 0; i < buffer.length; i += 1) {
      const opcode = buffer[i]
      if (opcode === TempOpcode.OP_label) {
        const labelId = readU32(buffer, i + 1)
        if (!labelPos.has(labelId)) {
          labelPos.set(labelId, i + 5)
        }
        i += 4
        continue
      }
      if (labelOps.has(opcode)) {
        const labelId = readU32(buffer, i + 1)
        const target = labelPos.get(labelId) ?? 0
        out.push(opcode, ...writeU32(target))
        i += 4
        continue
      }
      out.push(opcode)
    }
    return Uint8Array.from(out)
  }
}

/**
 * 移除临时 opcode（OP_label/OP_line_num）。
 *
 * @source QuickJS/src/core/parser.c:1828-1889
 */
export const stripTempOpcodes = (buffer: Uint8Array): Uint8Array => {
  const out: number[] = []
  for (let i = 0; i < buffer.length; i += 1) {
    const opcode = buffer[i]
    if (opcode === TempOpcode.OP_label) {
      i += 4
      continue
    }
    if (opcode === TempOpcode.OP_line_num) {
      i += 4
      continue
    }
    out.push(opcode)
  }
  return Uint8Array.from(out)
}
