import type { JSAtom } from '../types/function-def'
import type { InlineCacheManager } from '../ic/inline-cache'

/**
 * emit_ic 发射封装。
 *
 * @source QuickJS/src/core/parser.c:1815-1823
 * @see emit_ic
 */
export const emitIC = (ic: InlineCacheManager | undefined, atom: JSAtom) => {
  ic?.addSlot1(atom)
}
