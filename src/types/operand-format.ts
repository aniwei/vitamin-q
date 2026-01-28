export enum OperandFormat {
  NONE = 0,
  NONE_INT = 1,
  NONE_LOC = 2,
  NONE_ARG = 3,
  NONE_VAR_REF = 4,
  U8 = 5,
  I8 = 6,
  LOC8 = 7,
  CONST8 = 8,
  LABEL8 = 9,
  U16 = 10,
  I16 = 11,
  LABEL16 = 12,
  NPOP = 13,
  NPOPX = 14,
  NPOP_U16 = 15,
  LOC = 16,
  ARG = 17,
  VAR_REF = 18,
  U32 = 19,
  I32 = 20,
  CONST = 21,
  LABEL = 22,
  ATOM = 23,
  ATOM_U8 = 24,
  ATOM_U16 = 25,
  ATOM_LABEL_U8 = 26,
  ATOM_LABEL_U16 = 27,
  LABEL_U16 = 28,
}

const OPERAND_SIZES: Record<OperandFormat, number> = {
  [OperandFormat.NONE]: 0,
  [OperandFormat.NONE_INT]: 0,
  [OperandFormat.NONE_LOC]: 0,
  [OperandFormat.NONE_ARG]: 0,
  [OperandFormat.NONE_VAR_REF]: 0,
  [OperandFormat.U8]: 1,
  [OperandFormat.I8]: 1,
  [OperandFormat.LOC8]: 1,
  [OperandFormat.CONST8]: 1,
  [OperandFormat.LABEL8]: 1,
  [OperandFormat.U16]: 2,
  [OperandFormat.I16]: 2,
  [OperandFormat.LABEL16]: 2,
  [OperandFormat.NPOP]: 2,
  [OperandFormat.NPOPX]: 2,
  [OperandFormat.NPOP_U16]: 4,
  [OperandFormat.LOC]: 2,
  [OperandFormat.ARG]: 2,
  [OperandFormat.VAR_REF]: 2,
  [OperandFormat.U32]: 4,
  [OperandFormat.I32]: 4,
  [OperandFormat.CONST]: 4,
  [OperandFormat.LABEL]: 4,
  [OperandFormat.ATOM]: 4,
  [OperandFormat.ATOM_U8]: 5,
  [OperandFormat.ATOM_U16]: 6,
  [OperandFormat.ATOM_LABEL_U8]: 9,
  [OperandFormat.ATOM_LABEL_U16]: 10,
  [OperandFormat.LABEL_U16]: 6,
}

export const getOperandSize = (format: OperandFormat): number => {
  return OPERAND_SIZES[format] ?? 0
}

export interface DecodedOperand<T = number> {
  value: T
  size: number
}

export const decodeOperand = (
  format: OperandFormat,
  buffer: Uint8Array,
  offset: number,
): DecodedOperand => {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  switch (format) {
    case OperandFormat.U8:
    case OperandFormat.I8:
    case OperandFormat.LOC8:
    case OperandFormat.CONST8:
    case OperandFormat.LABEL8:
      return { value: buffer[offset], size: 1 }
    case OperandFormat.U16:
    case OperandFormat.I16:
    case OperandFormat.LABEL16:
    case OperandFormat.LOC:
    case OperandFormat.ARG:
    case OperandFormat.VAR_REF:
      return { value: view.getUint16(offset, true), size: 2 }
    case OperandFormat.U32:
    case OperandFormat.I32:
    case OperandFormat.CONST:
    case OperandFormat.LABEL:
    case OperandFormat.ATOM:
      return { value: view.getUint32(offset, true), size: 4 }
    default:
      return { value: 0, size: getOperandSize(format) }
  }
}

export const encodeOperand = (
  format: OperandFormat,
  value: number,
): Uint8Array => {
  const size = getOperandSize(format)
  const out = new Uint8Array(size)
  const view = new DataView(out.buffer)
  switch (format) {
    case OperandFormat.U8:
    case OperandFormat.I8:
    case OperandFormat.LOC8:
    case OperandFormat.CONST8:
    case OperandFormat.LABEL8:
      out[0] = value & 0xff
      return out
    case OperandFormat.U16:
    case OperandFormat.I16:
    case OperandFormat.LABEL16:
    case OperandFormat.LOC:
    case OperandFormat.ARG:
    case OperandFormat.VAR_REF:
      view.setUint16(0, value & 0xffff, true)
      return out
    case OperandFormat.U32:
    case OperandFormat.I32:
    case OperandFormat.CONST:
    case OperandFormat.LABEL:
    case OperandFormat.ATOM:
      view.setUint32(0, value >>> 0, true)
      return out
    default:
      return out
  }
}
