import type { JSAtom, JSFunctionDef } from '../types/function-def'
import { OPCODE_BY_CODE, TEMP_OPCODE_BY_CODE, ARGUMENT_VAR_OFFSET } from '../env'

export interface ResolveResult {
  bytecode: Uint8Array
}

/**
 * 变量解析（Phase 2）。
 *
 * @source parser.c: resolve_variables/resolve_scope_var
 */
export const resolveVariables = (fd: JSFunctionDef): ResolveResult => {
  const bc = fd.byteCode.buf
  const out: number[] = []

  let pos = 0
  while (pos < bc.length) {
    const op = bc[pos]
    const meta = OPCODE_BY_CODE[op] ?? TEMP_OPCODE_BY_CODE[op]
    const size = meta?.size ?? 1

    // TODO: resolve_scope_var / scope_make_ref / scope_get_ref
    for (let i = 0; i < size; i += 1) {
      out.push(bc[pos + i] ?? 0)
    }

    pos += size
  }

  return { bytecode: Uint8Array.from(out) }
}

export const findArg = (fd: JSFunctionDef, name: JSAtom): number => {
  for (let i = fd.argCount - 1; i >= 0; i -= 1) {
    if (fd.args[i].varName === name) return i | ARGUMENT_VAR_OFFSET
  }
  return -1
}
