import { JSAtom, JSVarKindEnum } from '../env'
import type { JSAtom as JSAtomId } from '../types/function-def'
import type { ScopeManager } from '../emitter/scope-manager'

/**
 * with 语句作用域辅助。
 *
 * @source QuickJS/src/core/parser.c:7716-7753
 * @see js_parse_statement_or_decl
 */
export const createWithScopeVar = (scopes: ScopeManager): { atom: JSAtomId; localIdx: number } => {
  const atom = JSAtom.JS_ATOM__with_ as JSAtomId
  const localIdx = scopes.addScopeVar(atom, JSVarKindEnum.JS_VAR_NORMAL)
  return { atom, localIdx }
}
