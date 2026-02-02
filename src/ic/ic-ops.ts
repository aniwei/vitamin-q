import type { JSAtom } from '../types/function-def'
import { InlineCacheManager } from './inline-cache'

/**
 * IC 操作封装。
 *
 * @source QuickJS/src/core/runtime.h:310-420
 */
export const addSlot1 = (ic: InlineCacheManager, atom: JSAtom) => ic.addSlot1(atom)
