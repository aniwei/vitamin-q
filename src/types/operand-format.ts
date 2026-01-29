import { OpFormat } from '../env'

/**
 * 操作数字段格式定义。
 *
 * @source QuickJS/include/QuickJS/quickjs-opcode.h:1-50
 */
export type OperandFormatName = keyof typeof OpFormat

export interface OperandFormatDescriptor {
  name: OperandFormatName
  format: OpFormat
  size: number
}

/**
 * 操作数字段大小（不含 opcode 字节）。
 *
 * @source QuickJS/include/QuickJS/quickjs-opcode.h:1-50
 */
export const OPERAND_FORMAT_SIZES: Record<OpFormat, number> = {
  [OpFormat.none]: 0,
  [OpFormat.none_int]: 0,
  [OpFormat.none_loc]: 0,
  [OpFormat.none_arg]: 0,
  [OpFormat.none_var_ref]: 0,
  [OpFormat.u8]: 1,
  [OpFormat.i8]: 1,
  [OpFormat.loc8]: 1,
  [OpFormat.const8]: 1,
  [OpFormat.label8]: 1,
  [OpFormat.u16]: 2,
  [OpFormat.i16]: 2,
  [OpFormat.label16]: 2,
  [OpFormat.npop]: 1,
  [OpFormat.npopx]: 0,
  [OpFormat.npop_u16]: 2,
  [OpFormat.loc]: 2,
  [OpFormat.arg]: 2,
  [OpFormat.var_ref]: 2,
  [OpFormat.u32]: 4,
  [OpFormat.i32]: 4,
  [OpFormat.const]: 4,
  [OpFormat.label]: 4,
  [OpFormat.atom]: 4,
  [OpFormat.atom_u8]: 5,
  [OpFormat.atom_u16]: 6,
  [OpFormat.atom_label_u8]: 9,
  [OpFormat.atom_label_u16]: 10,
  [OpFormat.label_u16]: 6,
}

export const getOperandSize = (format: OpFormat): number => OPERAND_FORMAT_SIZES[format] ?? 0

export interface OperandCodecOptions {
  /** 是否使用小端序，QuickJS 使用小端 */
  littleEndian?: boolean
}

const toView = (buffer: ArrayBufferLike, offset: number, length: number): DataView =>
  new DataView(buffer as ArrayBuffer, offset, length)

export const decodeOperand = (format: OpFormat, buffer: ArrayBufferLike, offset = 0, options: OperandCodecOptions = {}): number[] => {
  const littleEndian = options.littleEndian ?? true
  const size = getOperandSize(format)
  const view = toView(buffer, offset, size)

  switch (format) {
    case OpFormat.u8:
    case OpFormat.loc8:
    case OpFormat.const8:
    case OpFormat.label8:
    case OpFormat.npop:
      return [view.getUint8(0)]
    case OpFormat.i8:
      return [view.getInt8(0)]
    case OpFormat.u16:
    case OpFormat.label16:
    case OpFormat.npop_u16:
    case OpFormat.loc:
    case OpFormat.arg:
    case OpFormat.var_ref:
      return [view.getUint16(0, littleEndian)]
    case OpFormat.i16:
      return [view.getInt16(0, littleEndian)]
    case OpFormat.u32:
    case OpFormat.const:
    case OpFormat.label:
    case OpFormat.atom:
      return [view.getUint32(0, littleEndian)]
    case OpFormat.i32:
      return [view.getInt32(0, littleEndian)]
    case OpFormat.atom_u8:
      return [view.getUint32(0, littleEndian), view.getUint8(4)]
    case OpFormat.atom_u16:
      return [view.getUint32(0, littleEndian), view.getUint16(4, littleEndian)]
    case OpFormat.atom_label_u8:
      return [view.getUint32(0, littleEndian), view.getInt32(4, littleEndian), view.getUint8(8)]
    case OpFormat.atom_label_u16:
      return [view.getUint32(0, littleEndian), view.getInt32(4, littleEndian), view.getUint16(8, littleEndian)]
    case OpFormat.label_u16:
      return [view.getInt32(0, littleEndian), view.getUint16(4, littleEndian)]
    case OpFormat.none:
    case OpFormat.none_int:
    case OpFormat.none_loc:
    case OpFormat.none_arg:
    case OpFormat.none_var_ref:
    case OpFormat.npopx:
      return []
    default:
      return []
  }
}

export const encodeOperand = (
  format: OpFormat,
  buffer: ArrayBufferLike,
  offset: number,
  values: number[],
  options: OperandCodecOptions = {},
): void => {
  const littleEndian = options.littleEndian ?? true
  const size = getOperandSize(format)
  const view = toView(buffer, offset, size)

  switch (format) {
    case OpFormat.u8:
    case OpFormat.loc8:
    case OpFormat.const8:
    case OpFormat.label8:
    case OpFormat.npop:
      view.setUint8(0, values[0] ?? 0)
      break
    case OpFormat.i8:
      view.setInt8(0, values[0] ?? 0)
      break
    case OpFormat.u16:
    case OpFormat.label16:
    case OpFormat.npop_u16:
    case OpFormat.loc:
    case OpFormat.arg:
    case OpFormat.var_ref:
      view.setUint16(0, values[0] ?? 0, littleEndian)
      break
    case OpFormat.i16:
      view.setInt16(0, values[0] ?? 0, littleEndian)
      break
    case OpFormat.u32:
    case OpFormat.const:
    case OpFormat.label:
    case OpFormat.atom:
      view.setUint32(0, values[0] ?? 0, littleEndian)
      break
    case OpFormat.i32:
      view.setInt32(0, values[0] ?? 0, littleEndian)
      break
    case OpFormat.atom_u8:
      view.setUint32(0, values[0] ?? 0, littleEndian)
      view.setUint8(4, values[1] ?? 0)
      break
    case OpFormat.atom_u16:
      view.setUint32(0, values[0] ?? 0, littleEndian)
      view.setUint16(4, values[1] ?? 0, littleEndian)
      break
    case OpFormat.atom_label_u8:
      view.setUint32(0, values[0] ?? 0, littleEndian)
      view.setInt32(4, values[1] ?? 0, littleEndian)
      view.setUint8(8, values[2] ?? 0)
      break
    case OpFormat.atom_label_u16:
      view.setUint32(0, values[0] ?? 0, littleEndian)
      view.setInt32(4, values[1] ?? 0, littleEndian)
      view.setUint16(8, values[2] ?? 0, littleEndian)
      break
    case OpFormat.label_u16:
      view.setInt32(0, values[0] ?? 0, littleEndian)
      view.setUint16(4, values[1] ?? 0, littleEndian)
      break
    case OpFormat.none:
    case OpFormat.none_int:
    case OpFormat.none_loc:
    case OpFormat.none_arg:
    case OpFormat.none_var_ref:
    case OpFormat.npopx:
    default:
      break
  }
}
