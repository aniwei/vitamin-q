import { Opcode, OPCODE_BY_CODE, TEMP_OPCODE_BY_CODE, TEMP_OPCODE_MAX, TEMP_OPCODE_MIN, TempOpcode } from '../env'

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

const getOpcodeDef = (opcode: number) => {
  if (opcode >= TEMP_OPCODE_MIN && opcode <= TEMP_OPCODE_MAX) {
    return TEMP_OPCODE_BY_CODE[opcode] ?? OPCODE_BY_CODE[opcode]
  }
  return OPCODE_BY_CODE[opcode] ?? TEMP_OPCODE_BY_CODE[opcode]
}

const emitOp = (out: number[], opcode: number) => {
  out.push(opcode)
}

const emitU32 = (out: number[], value: number) => {
  out.push(...writeU32(value))
}

const emitLabel = (out: number[], labelId: number) => {
  emitOp(out, TempOpcode.OP_label)
  emitU32(out, labelId)
}

const emitGoto = (out: number[], opcode: number, labelId: number) => {
  emitOp(out, opcode)
  emitU32(out, labelId)
}

const emitGetFieldOptChain = (out: number[], atom: number, labelIds: { next: () => number }) => {
  const notNullLabel = labelIds.next()
  const doneLabel = labelIds.next()
  emitOp(out, Opcode.OP_dup)
  emitOp(out, Opcode.OP_is_undefined_or_null)
  emitGoto(out, Opcode.OP_if_false, notNullLabel)
  emitOp(out, Opcode.OP_drop)
  emitOp(out, Opcode.OP_undefined)
  emitGoto(out, Opcode.OP_goto, doneLabel)
  emitLabel(out, notNullLabel)
  emitOp(out, Opcode.OP_get_field)
  emitU32(out, atom)
  emitLabel(out, doneLabel)
}

const emitGetArrayElOptChain = (out: number[], labelIds: { next: () => number }) => {
  const notNullLabel = labelIds.next()
  const doneLabel = labelIds.next()
  emitOp(out, Opcode.OP_dup1)
  emitOp(out, Opcode.OP_is_undefined_or_null)
  emitGoto(out, Opcode.OP_if_false, notNullLabel)
  emitOp(out, Opcode.OP_drop)
  emitOp(out, Opcode.OP_drop)
  emitOp(out, Opcode.OP_undefined)
  emitGoto(out, Opcode.OP_goto, doneLabel)
  emitLabel(out, notNullLabel)
  emitOp(out, Opcode.OP_get_array_el)
  emitLabel(out, doneLabel)
}

export const resolveVariables = (buffer: Uint8Array, labelStart = 0): Uint8Array => {
  const out: number[] = []
  let nextLabelId = labelStart
  const labelIds = { next: () => nextLabelId++ }

  for (let i = 0; i < buffer.length; i += 1) {
    const opcode = buffer[i]
    if (opcode === TempOpcode.OP_get_field_opt_chain) {
      const atom = readU32(buffer, i + 1)
      emitGetFieldOptChain(out, atom, labelIds)
      i += 4
      continue
    }
    if (opcode === TempOpcode.OP_get_array_el_opt_chain) {
      emitGetArrayElOptChain(out, labelIds)
      continue
    }

    const def = getOpcodeDef(opcode)
    if (!def) throw new Error(`Unknown opcode: ${opcode}`)
    for (let j = 0; j < def.size; j += 1) {
      out.push(buffer[i + j])
    }
    i += def.size - 1
  }

  return Uint8Array.from(out)
}
