import { Opcode, OPCODE_BY_CODE } from '../env'

const readU16 = (buffer: Uint8Array, offset: number): number => (
	buffer[offset] | (buffer[offset + 1] << 8)
)

const writeU16 = (value: number): number[] => [value & 0xff, (value >>> 8) & 0xff]

const getSize = (opcode: number): number => OPCODE_BY_CODE[opcode]?.size ?? 1

const emitRaw = (out: number[], bytecode: Uint8Array, start: number, size: number) => {
	for (let i = 0; i < size; i += 1) {
		out.push(bytecode[start + i])
	}
}

/**
 * 窥孔优化（最小实现）。
 *
 * @source QuickJS/src/core/parser.c:11896-12010
 */
export const peepholeOptimize = (bytecode: Uint8Array): Uint8Array => {
	const out: number[] = []
	for (let i = 0; i < bytecode.length; i += 1) {
		const opcode = bytecode[i]
		if (opcode === Opcode.OP_typeof_is_undefined || opcode === Opcode.OP_typeof_is_function) {
			const size0 = getSize(opcode)
			const pos1 = i + size0
			if (pos1 < bytecode.length && bytecode[pos1] === Opcode.OP_lnot) {
				const size1 = getSize(Opcode.OP_lnot)
				const pos2 = pos1 + size1
				if (pos2 < bytecode.length) {
					const op2 = bytecode[pos2]
					if (op2 === Opcode.OP_if_false || op2 === Opcode.OP_if_false8) {
						const mapped = op2 === Opcode.OP_if_false ? Opcode.OP_if_true : Opcode.OP_if_true8
						emitRaw(out, bytecode, i, size0)
						out.push(mapped)
						emitRaw(out, bytecode, pos2 + 1, getSize(op2) - 1)
						i = pos2 + getSize(op2) - 1
						continue
					}
				}
			}
		}
		if (opcode === Opcode.OP_insert2) {
			const size0 = getSize(opcode)
			const pos1 = i + size0
			if (pos1 < bytecode.length) {
				const op1 = bytecode[pos1]
				if (op1 === Opcode.OP_put_field || op1 === Opcode.OP_put_var_strict) {
					const size1 = getSize(op1)
					const pos2 = pos1 + size1
					if (pos2 < bytecode.length && bytecode[pos2] === Opcode.OP_drop) {
						emitRaw(out, bytecode, pos1, size1)
						i = pos2
						continue
					}
				}
			}
		}
		if (opcode === Opcode.OP_put_loc || opcode === Opcode.OP_put_arg || opcode === Opcode.OP_put_var_ref) {
			const idx = readU16(bytecode, i + 1)
			const nextPos = i + getSize(opcode)
			if (nextPos < bytecode.length) {
				const nextOp = bytecode[nextPos]
				const expectedGet = opcode - 1
				if (nextOp === expectedGet) {
					const nextIdx = readU16(bytecode, nextPos + 1)
					if (nextIdx === idx) {
						const setOp = opcode + 1
						out.push(setOp, ...writeU16(idx))
						i = nextPos + getSize(nextOp) - 1
						continue
					}
				}
			}
		}
		const size = getSize(opcode)
		emitRaw(out, bytecode, i, size)
		i += size - 1
	}
	return Uint8Array.from(out)
}
