import type { JSAtom as JSAtomId } from '../types/function-def'
import { JSVarKindEnum } from '../env'
import type { ScopeManager } from '../emitter/scope-manager'
import type { AtomTable } from './atom-table'

/**
 * Atom 与变量名集成工具。
 *
 * @source QuickJS/src/core/parser.c:4210-4285
 * @see js_define_var
 */
export const defineScopeVarFromName = (
  scopes: ScopeManager,
  atoms: AtomTable,
  name: string,
  varKind: JSVarKindEnum = JSVarKindEnum.JS_VAR_NORMAL,
): { atom: JSAtomId; localIdx: number } => {
  const atom = atoms.getOrAdd(name) as JSAtomId
  const localIdx = scopes.addScopeVar(atom, varKind)
  return { atom, localIdx }
}
