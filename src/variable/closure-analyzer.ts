import type { ScopeManager } from './scope-manager'
import type { JSAtom as JSAtomId } from '../types/function-def'

export interface ClosureReference {
  atom: JSAtomId
  scopeLevel: number
}

/**
 * 闭包变量处理。
 *
 * @source QuickJS/src/core/parser.c:2000-2050
 * @see find_var_in_child_scope
 */
export class ClosureAnalyzer {
  constructor(private scopes: ScopeManager) {}

  markCaptured(index: number) {
    const vd = this.scopes.vars[index]
    if (vd) vd.isCaptured = true
  }

  /**
   * 根据引用标记捕获变量。
   */
  analyze(references: ClosureReference[]) {
    for (const ref of references) {
      const idx = this.scopes.findVarInScope(ref.atom, ref.scopeLevel)
      if (idx >= 0) this.markCaptured(idx)
    }
  }
}
