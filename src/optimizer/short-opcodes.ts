import { JSAtom, Opcode, OPCODE_BY_CODE } from '../env'

const readU16 = (buffer: Uint8Array, offset: number): number => (
	buffer[offset] | (buffer[offset + 1] << 8)
)

const readU32 = (buffer: Uint8Array, offset: number): number => (
	buffer[offset] |
	(buffer[offset + 1] << 8) |
	(buffer[offset + 2] << 16) |
	(buffer[offset + 3] << 24)
)

const writeU16 = (value: number): number[] => [value & 0xff, (value >>> 8) & 0xff]

/**
 * 短操作码转换（最小实现）。
 *
 * @source QuickJS/src/core/parser.c:11050-11450
 */
export const convertShortOpcodes = (bytecode: Uint8Array): Uint8Array => {
	const out: number[] = []
	for (let i = 0; i < bytecode.length; i += 1) {
		const opcode = bytecode[i]
		switch (opcode) {
			case Opcode.OP_push_i32: {
				const raw = readU32(bytecode, i + 1)
				const value = raw | 0
				if (value >= 0 && value <= 7) {
					const mapping = [
						Opcode.OP_push_0,
						Opcode.OP_push_1,
						Opcode.OP_push_2,
						Opcode.OP_push_3,
						Opcode.OP_push_4,
						Opcode.OP_push_5,
						Opcode.OP_push_6,
						Opcode.OP_push_7,
					]
					out.push(mapping[value])
				} else if (value >= -128 && value <= 127) {
					out.push(Opcode.OP_push_i8, value & 0xff)
				} else if (value >= -32768 && value <= 32767) {
					out.push(Opcode.OP_push_i16, ...writeU16(value & 0xffff))
				} else {
					out.push(opcode, raw & 0xff, (raw >>> 8) & 0xff, (raw >>> 16) & 0xff, (raw >>> 24) & 0xff)
				}
				i += 4
				break
			}
			case Opcode.OP_get_loc:
			case Opcode.OP_put_loc:
			case Opcode.OP_set_loc: {
				const index = readU16(bytecode, i + 1)
				const map = {
					[Opcode.OP_get_loc]: [Opcode.OP_get_loc0, Opcode.OP_get_loc1, Opcode.OP_get_loc2, Opcode.OP_get_loc3],
					[Opcode.OP_put_loc]: [Opcode.OP_put_loc0, Opcode.OP_put_loc1, Opcode.OP_put_loc2, Opcode.OP_put_loc3],
					[Opcode.OP_set_loc]: [Opcode.OP_set_loc0, Opcode.OP_set_loc1, Opcode.OP_set_loc2, Opcode.OP_set_loc3],
				} as const
				if (index <= 3) {
					out.push(map[opcode as keyof typeof map][index])
				} else if (index <= 0xff) {
					const shortMap = {
						[Opcode.OP_get_loc]: Opcode.OP_get_loc8,
						[Opcode.OP_put_loc]: Opcode.OP_put_loc8,
						[Opcode.OP_set_loc]: Opcode.OP_set_loc8,
					} as const
					out.push(shortMap[opcode as keyof typeof shortMap], index & 0xff)
				} else {
					out.push(opcode, ...writeU16(index))
				}
				i += 2
				break
			}
			case Opcode.OP_get_arg:
			case Opcode.OP_put_arg:
			case Opcode.OP_set_arg: {
				const index = readU16(bytecode, i + 1)
				const map = {
					[Opcode.OP_get_arg]: [Opcode.OP_get_arg0, Opcode.OP_get_arg1, Opcode.OP_get_arg2, Opcode.OP_get_arg3],
					[Opcode.OP_put_arg]: [Opcode.OP_put_arg0, Opcode.OP_put_arg1, Opcode.OP_put_arg2, Opcode.OP_put_arg3],
					[Opcode.OP_set_arg]: [Opcode.OP_set_arg0, Opcode.OP_set_arg1, Opcode.OP_set_arg2, Opcode.OP_set_arg3],
				} as const
				if (index <= 3) {
					out.push(map[opcode as keyof typeof map][index])
				} else {
					out.push(opcode, ...writeU16(index))
				}
				i += 2
				break
			}
			case Opcode.OP_push_const: {
				const index = readU32(bytecode, i + 1)
				if (index <= 0xff) {
					out.push(Opcode.OP_push_const8, index & 0xff)
				} else {
					out.push(opcode, index & 0xff, (index >>> 8) & 0xff, (index >>> 16) & 0xff, (index >>> 24) & 0xff)
				}
				i += 4
				break
			}
			case Opcode.OP_fclosure: {
				const index = readU32(bytecode, i + 1)
				if (index <= 0xff) {
					out.push(Opcode.OP_fclosure8, index & 0xff)
				} else {
					out.push(opcode, index & 0xff, (index >>> 8) & 0xff, (index >>> 16) & 0xff, (index >>> 24) & 0xff)
				}
				i += 4
				break
			}
			case Opcode.OP_push_atom_value: {
				const atom = readU32(bytecode, i + 1)
				if (atom === JSAtom.JS_ATOM_empty_string) {
					out.push(Opcode.OP_push_empty_string)
				} else {
					out.push(opcode, atom & 0xff, (atom >>> 8) & 0xff, (atom >>> 16) & 0xff, (atom >>> 24) & 0xff)
				}
				i += 4
				break
			}
			case Opcode.OP_get_var_ref:
			case Opcode.OP_put_var_ref:
			case Opcode.OP_set_var_ref: {
				const index = readU16(bytecode, i + 1)
				const map = {
					[Opcode.OP_get_var_ref]: [Opcode.OP_get_var_ref0, Opcode.OP_get_var_ref1, Opcode.OP_get_var_ref2, Opcode.OP_get_var_ref3],
					[Opcode.OP_put_var_ref]: [Opcode.OP_put_var_ref0, Opcode.OP_put_var_ref1, Opcode.OP_put_var_ref2, Opcode.OP_put_var_ref3],
					[Opcode.OP_set_var_ref]: [Opcode.OP_set_var_ref0, Opcode.OP_set_var_ref1, Opcode.OP_set_var_ref2, Opcode.OP_set_var_ref3],
				} as const
				if (index <= 3) {
					out.push(map[opcode as keyof typeof map][index])
				} else {
					out.push(opcode, ...writeU16(index))
				}
				i += 2
				break
			}
			case Opcode.OP_call: {
				const argCount = readU16(bytecode, i + 1)
				if (argCount <= 3) {
					out.push([
						Opcode.OP_call0,
						Opcode.OP_call1,
						Opcode.OP_call2,
						Opcode.OP_call3,
					][argCount])
				} else {
					out.push(opcode, ...writeU16(argCount))
				}
				i += 2
				break
			}
			case Opcode.OP_if_true:
			case Opcode.OP_if_false:
			case Opcode.OP_goto: {
				const raw = readU32(bytecode, i + 1)
				const diff = raw | 0
				if (opcode === Opcode.OP_goto && diff >= -32768 && diff <= 32767) {
					if (diff >= -128 && diff <= 127) {
						out.push(Opcode.OP_goto8, diff & 0xff)
					} else {
						out.push(Opcode.OP_goto16, ...writeU16(diff & 0xffff))
					}
				} else if (opcode !== Opcode.OP_goto && diff >= -128 && diff <= 127) {
					out.push(opcode === Opcode.OP_if_true ? Opcode.OP_if_true8 : Opcode.OP_if_false8, diff & 0xff)
				} else {
					out.push(opcode, raw & 0xff, (raw >>> 8) & 0xff, (raw >>> 16) & 0xff, (raw >>> 24) & 0xff)
				}
				i += 4
				break
			}
			default: {
				const def = OPCODE_BY_CODE[opcode]
				if (!def) {
					out.push(opcode)
					break
				}
				const size = def.size
				for (let j = 0; j < size; j += 1) {
					out.push(bytecode[i + j])
				}
				i += size - 1
				break
			}
		}
	}
	return Uint8Array.from(out)
}
