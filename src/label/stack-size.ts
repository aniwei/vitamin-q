import { JS_STACK_SIZE_MAX, OpFormat, Opcode, OPCODE_BY_CODE, TEMP_OPCODE_BY_CODE } from '../env'

const readU16 = (buf: Uint8Array, offset: number) => buf[offset] | (buf[offset + 1] << 8)
const readI16 = (buf: Uint8Array, offset: number) => (readU16(buf, offset) << 16) >> 16
const readU32 = (buf: Uint8Array, offset: number) =>
  (buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24)) >>> 0
const readI8 = (buf: Uint8Array, offset: number) => (buf[offset] << 24) >> 24

/**
 * 计算字节码最大栈深。
 *
 * @source QuickJS/src/core/parser.c:12200-12340
 * @see compute_stack_size
 */
export const computeStackSize = (bytecode: Uint8Array): number => {
  try {
    const bcLen = bytecode.length
    if (!bcLen) return 0

  const stackLevel = new Int32Array(bcLen).fill(-1)
  const catchPos = new Int32Array(bcLen).fill(-1)
  const pcStack: number[] = []
  let stackLenMax = 0

  const ssCheck = (pos: number, op: number, stackLen: number, catchOffset: number): boolean => {
    if (pos < 0 || pos >= bcLen) {
      throw new Error(`bytecode buffer overflow (op=${op}, pc=${pos})`)
    }
    if (stackLen > stackLenMax) {
      stackLenMax = stackLen
      if (stackLenMax > JS_STACK_SIZE_MAX) {
        throw new Error(`stack overflow (op=${op}, pc=${pos})`)
      }
    }
    if (stackLevel[pos] !== -1) {
      if (stackLevel[pos] !== stackLen) {
        throw new Error(`inconsistent stack size: ${stackLevel[pos]} ${stackLen} (pc=${pos})`)
      }
      if (catchPos[pos] !== catchOffset) {
        throw new Error(`inconsistent catch position: ${catchPos[pos]} ${catchOffset} (pc=${pos})`)
      }
      return false
    }

    stackLevel[pos] = stackLen
    catchPos[pos] = catchOffset
    pcStack.push(pos)
    return true
  }

    ssCheck(0, Opcode.OP_invalid, 0, -1)

    while (pcStack.length > 0) {
      const pos = pcStack.pop() as number
      let stackLen = stackLevel[pos]
      let catchOffset = catchPos[pos]
      const op = bytecode[pos]
      const info = TEMP_OPCODE_BY_CODE[op] ?? OPCODE_BY_CODE[op]
      if (!info) throw new Error(`invalid opcode (op=${op}, pc=${pos})`)

    const posNextDefault = pos + info.size
    if (posNextDefault > bcLen) {
      throw new Error(`bytecode buffer overflow (op=${op}, pc=${pos})`)
    }

    let nPop = info.nPop
    if (info.format === OpFormat.npop || info.format === OpFormat.npop_u16) {
      nPop += readU16(bytecode, pos + 1)
    } else if (info.format === OpFormat.npopx) {
      nPop += op - Opcode.OP_call0
    }

    if (stackLen < nPop) {
      throw new Error(`stack underflow (op=${op}, pc=${pos})`)
    }
    stackLen += info.nPush - nPop
    if (stackLen > stackLenMax) {
      stackLenMax = stackLen
      if (stackLenMax > JS_STACK_SIZE_MAX) {
        throw new Error(`stack overflow (op=${op}, pc=${pos})`)
      }
    }

    let posNext = posNextDefault
    switch (op) {
      case Opcode.OP_tail_call:
      case Opcode.OP_tail_call_method:
      case Opcode.OP_return:
      case Opcode.OP_return_undef:
      case Opcode.OP_return_async:
      case Opcode.OP_throw:
      case Opcode.OP_throw_error:
      case Opcode.OP_ret:
        continue
      case Opcode.OP_goto: {
        const diff = readU32(bytecode, pos + 1)
        posNext = pos + 1 + diff
        break
      }
      case Opcode.OP_goto16: {
        const diff = readI16(bytecode, pos + 1)
        posNext = pos + 1 + diff
        break
      }
      case Opcode.OP_goto8: {
        const diff = readI8(bytecode, pos + 1)
        posNext = pos + 1 + diff
        break
      }
      case Opcode.OP_if_true8:
      case Opcode.OP_if_false8: {
        const diff = readI8(bytecode, pos + 1)
        ssCheck(pos + 1 + diff, op, stackLen, catchOffset)
        break
      }
      case Opcode.OP_if_true:
      case Opcode.OP_if_false: {
        const diff = readU32(bytecode, pos + 1)
        ssCheck(pos + 1 + diff, op, stackLen, catchOffset)
        break
      }
      case Opcode.OP_gosub: {
        const diff = readU32(bytecode, pos + 1)
        ssCheck(pos + 1 + diff, op, stackLen + 1, catchOffset)
        break
      }
      case Opcode.OP_with_get_var:
      case Opcode.OP_with_delete_var: {
        const diff = readU32(bytecode, pos + 5)
        ssCheck(pos + 5 + diff, op, stackLen + 1, catchOffset)
        break
      }
      case Opcode.OP_with_make_ref:
      case Opcode.OP_with_get_ref: {
        const diff = readU32(bytecode, pos + 5)
        ssCheck(pos + 5 + diff, op, stackLen + 2, catchOffset)
        break
      }
      case Opcode.OP_with_put_var: {
        const diff = readU32(bytecode, pos + 5)
        ssCheck(pos + 5 + diff, op, stackLen - 1, catchOffset)
        break
      }
      case Opcode.OP_catch: {
        const diff = readU32(bytecode, pos + 1)
        ssCheck(pos + 1 + diff, op, stackLen, catchOffset)
        catchOffset = pos
        break
      }
      case Opcode.OP_for_of_start:
      case Opcode.OP_for_await_of_start:
        catchOffset = pos
        break
      case Opcode.OP_drop: {
        let catchLevel = stackLen
        if (catchOffset >= 0) {
          let level = stackLevel[catchOffset]
          if (bytecode[catchOffset] !== Opcode.OP_catch) level += 1
          if (catchLevel === level) {
            catchOffset = catchPos[catchOffset]
          }
        }
        break
      }
      case Opcode.OP_nip:
      case Opcode.OP_nip1: {
        let catchLevel = stackLen - 1
        if (catchOffset >= 0) {
          let level = stackLevel[catchOffset]
          if (bytecode[catchOffset] !== Opcode.OP_catch) level += 1
          if (catchLevel === level) {
            catchOffset = catchPos[catchOffset]
          }
        }
        break
      }
      case Opcode.OP_iterator_close: {
        let catchLevel = stackLen + 2
        if (catchOffset >= 0) {
          let level = stackLevel[catchOffset]
          if (bytecode[catchOffset] !== Opcode.OP_catch) level += 1
          if (catchLevel === level) {
            catchOffset = catchPos[catchOffset]
          }
        }
        break
      }
      case Opcode.OP_nip_catch: {
        if (catchOffset < 0) {
          throw new Error(`nip_catch: no catch op (pc=${pos})`)
        }
        stackLen = stackLevel[catchOffset]
        if (bytecode[catchOffset] !== Opcode.OP_catch) stackLen += 1
        stackLen += 1
        catchOffset = catchPos[catchOffset]
        break
      }
      default:
        break
    }

      ssCheck(posNext, op, stackLen, catchOffset)
    }

    return stackLenMax
  } catch {
    return 0
  }
}
