import { OPCODE_BY_CODE, SHORT_OPCODES } from '../env'
import type { JSFunctionDef } from '../types/function-def'

/**
 * 计算最大栈深度。
 *
 * @source parser.c: compute_stack_size
 */
export const computeStackSize = (fd: JSFunctionDef): number => {
  const bc = fd.byteCode.buf
  let sp = 0
  let max = 0
  let pos = 0

  while (pos < bc.length) {
    const op = bc[pos]
    const info = OPCODE_BY_CODE[op]
    const size = info?.size ?? 1
    const nPop = info?.nPop ?? 0
    const nPush = info?.nPush ?? 0

    sp -= nPop
    if (sp < 0) sp = 0
    sp += nPush
    if (sp > max) max = sp

    pos += size
  }

  return max
}
