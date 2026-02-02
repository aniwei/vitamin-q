import { JS_ATOM_NULL } from '../env'
import type { BlockEnv, JSAtom } from '../types/function-def'

export type BlockEnvInit = Partial<BlockEnv> & { labelName?: JSAtom }

/**
 * BlockEnv 构造器（对齐 QuickJS BlockEnv 结构）。
 *
 * @source QuickJS/src/core/parser.h:120-150
 */
export const createBlockEnv = (init: BlockEnvInit = {}): BlockEnv => ({
  prev: init.prev ?? null,
  labelName: init.labelName ?? JS_ATOM_NULL,
  labelBreak: init.labelBreak ?? -1,
  labelCont: init.labelCont ?? -1,
  dropCount: init.dropCount ?? 0,
  labelFinally: init.labelFinally ?? -1,
  scopeLevel: init.scopeLevel ?? 0,
  hasIterator: init.hasIterator ?? false,
  isRegularStmt: init.isRegularStmt ?? false,
})
