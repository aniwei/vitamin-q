import type { JSFunctionDef } from '../types/function-def'
import { resolveVariables } from '../variable/variable-resolver'
import { resolveLabels } from '../label/label-resolver'
import { computeStackSize } from '../label/stack-size'

export interface CreateFunctionResult {
  bytecode: Uint8Array
  stackSize: number
}

/**
 * 编译阶段汇总。
 *
 * @source parser.c: js_create_function
 */
export const createFunction = (fd: JSFunctionDef): CreateFunctionResult => {
  const pass2 = resolveVariables(fd)
  fd.byteCode = { buf: pass2.bytecode, size: pass2.bytecode.length } as any

  const pass3 = resolveLabels(fd)
  fd.byteCode = { buf: pass3.bytecode, size: pass3.bytecode.length } as any

  const stackSize = computeStackSize(fd)
  return { bytecode: pass3.bytecode, stackSize }
}
