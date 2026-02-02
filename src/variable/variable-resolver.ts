import type { JSAtom as JSAtomId } from '../types/function-def'
import type { ScopeManager } from './scope-manager'
import type { AtomTable } from '../atom/atom-table'

export type VariableResolutionKind = 'local' | 'arg' | 'var' | 'global'

export interface VariableResolution {
  kind: VariableResolutionKind
  atom: JSAtomId
  index?: number
}

/**
 * 变量解析器（对齐 QuickJS 变量查找流程）。
 *
 * @source QuickJS/src/core/parser.c:1944-1998
 * @see find_var
 * @see find_var_in_scope
 */
export class VariableResolver {
  constructor(
    private scopes: ScopeManager,
    private atomTable: AtomTable,
    private argMap: Map<string, number> = new Map(),
  ) {}

  /**
   * 解析标识符。
   */
  resolveIdentifier(name: string): VariableResolution {
    const atom = this.atomTable.getOrAdd(name) as JSAtomId
    const scopeLevel = this.scopes.scopeLevel

    if (scopeLevel >= 0) {
      const localIdx = this.scopes.findVarInScope(atom, scopeLevel)
      if (localIdx >= 0) {
        return { kind: 'local', atom, index: localIdx }
      }
    }

    const argIndex = this.argMap.get(name)
    if (argIndex !== undefined) {
      return { kind: 'arg', atom, index: argIndex }
    }

    const varIndex = this.scopes.findVar(atom)
    if (varIndex >= 0) {
      return { kind: 'var', atom, index: varIndex }
    }

    return { kind: 'global', atom }
  }
}
