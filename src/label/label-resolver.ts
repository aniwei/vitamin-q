import { OpFormat, Opcode, OPCODE_BY_CODE, TEMP_OPCODE_BY_CODE, TEMP_OPCODE_MAX, TEMP_OPCODE_MIN, TempOpcode } from '../env'
import { decodeOperand, encodeOperand } from '../types/operand-format'
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

const labelFormats = new Set<OpFormat>([
  OpFormat.label,
  OpFormat.label8,
  OpFormat.label16,
  OpFormat.label_u16,
  OpFormat.atom_label_u8,
  OpFormat.atom_label_u16,
])

const getOpcodeDef = (opcode: number) => {
  if (opcode >= TEMP_OPCODE_MIN && opcode <= TEMP_OPCODE_MAX) {
    return TEMP_OPCODE_BY_CODE[opcode] ?? OPCODE_BY_CODE[opcode]
  }
  return OPCODE_BY_CODE[opcode] ?? TEMP_OPCODE_BY_CODE[opcode]
}

const isTempStripped = (opcode: number): boolean => (
  opcode === TempOpcode.OP_label ||
  opcode === TempOpcode.OP_line_num ||
  opcode === TempOpcode.OP_set_class_name ||
  opcode === TempOpcode.OP_enter_scope ||
  opcode === TempOpcode.OP_leave_scope
)

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

    let inputPos = 0
    let outputPos = 0
    while (inputPos < buffer.length) {
      const opcode = buffer[inputPos]
      const def = getOpcodeDef(opcode)
      if (!def) throw new Error(`Unknown opcode: ${opcode}`)
      if (opcode === TempOpcode.OP_label) {
        const labelId = readU32(buffer, inputPos + 1)
        labelPos.set(labelId, outputPos)
        inputPos += def.size
        continue
      }
      if (isTempStripped(opcode)) {
        inputPos += def.size
        continue
      }
      inputPos += def.size
      outputPos += def.size
    }

    const out = new Uint8Array(outputPos)
    inputPos = 0
    outputPos = 0
    while (inputPos < buffer.length) {
      const opcode = buffer[inputPos]
      const def = getOpcodeDef(opcode)
      if (!def) throw new Error(`Unknown opcode: ${opcode}`)
      if (opcode === TempOpcode.OP_label) {
        inputPos += def.size
        continue
      }
      if (isTempStripped(opcode)) {
        inputPos += def.size
        continue
      }

      out[outputPos] = opcode
      if (labelFormats.has(def.format)) {
        const values = decodeOperand(def.format, buffer.buffer, buffer.byteOffset + inputPos + 1)
        const labelIndex = def.format === OpFormat.atom_label_u8 || def.format === OpFormat.atom_label_u16 ? 1 : 0
        const labelFieldOffset = def.format === OpFormat.atom_label_u8 || def.format === OpFormat.atom_label_u16 ? 4 : 0
        const target = labelPos.get(values[labelIndex]) ?? 0
        values[labelIndex] = target - (outputPos + 1 + labelFieldOffset)
        encodeOperand(def.format, out.buffer, out.byteOffset + outputPos + 1, values)
      } else if (def.size > 1) {
        out.set(buffer.subarray(inputPos + 1, inputPos + def.size), outputPos + 1)
      }

      inputPos += def.size
      outputPos += def.size
    }

    return out
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
    if (opcode === TempOpcode.OP_enter_scope || opcode === TempOpcode.OP_leave_scope) {
      i += 2
      continue
    }
    if (opcode === TempOpcode.OP_label) {
      i += 4
      continue
    }
    if (opcode === TempOpcode.OP_line_num) {
      i += 4
      continue
    }
    if (opcode === TempOpcode.OP_set_class_name) {
      i += 4
      continue
    }
    out.push(opcode)
  }
  return Uint8Array.from(out)
}
