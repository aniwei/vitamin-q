import type { JSAtom, JSVarDef, JSVarScope } from '../types/function-def'
import { JSVarKindEnum } from '../env'

export interface ScopeManagerState {
  vars: JSVarDef[]
  scopes: JSVarScope[]
  scopeLevel: number
  scopeFirst: number
}

/**
 * 作用域表管理（对齐 QuickJS scope/vars 结构）。
 *
 * @source QuickJS/src/core/parser.c:1940-2165
 * @see push_scope
 */
export class ScopeManager {
  readonly vars: JSVarDef[] = []
  readonly scopes: JSVarScope[] = []
  scopeLevel = -1
  scopeFirst = -1

  /**
   * 推入新的作用域。
   *
   * @source QuickJS/src/core/parser.c:2050-2085
   * @see push_scope
   */
  pushScope(): number {
    const scope = this.scopes.length
    this.scopes.push({ parent: this.scopeLevel, first: this.scopeFirst })
    this.scopeLevel = scope
    return scope
  }

  /**
   * 弹出作用域。
   *
   * @source QuickJS/src/core/parser.c:2097-2120
   * @see pop_scope
   */
  popScope(): number {
    if (this.scopeLevel < 0) return -1
    const current = this.scopeLevel
    this.scopeLevel = this.scopes[current].parent
    this.scopeFirst = this.getFirstLexicalVar(this.scopeLevel)
    return current
  }

  /**
   * 添加变量定义。
   *
   * @source QuickJS/src/core/parser.c:2127-2165
   * @see add_var
   */
  addVar(name: JSAtom): number {
    const index = this.vars.length
    this.vars.push({
      varName: name,
      scopeLevel: 0,
      scopeNext: -1,
      isConst: false,
      isLexical: false,
      isCaptured: false,
      isStaticPrivate: false,
      varKind: JSVarKindEnum.JS_VAR_NORMAL,
      funcPoolIdx: -1,
    })
    return index
  }

  /**
   * 添加作用域变量定义。
   *
   * @source QuickJS/src/core/parser.c:2150-2165
   * @see add_scope_var
   */
  addScopeVar(name: JSAtom, varKind: JSVarKindEnum): number {
    const idx = this.addVar(name)
    const vd = this.vars[idx]
    vd.varKind = varKind
    vd.scopeLevel = this.scopeLevel
    vd.scopeNext = this.scopeFirst
    if (this.scopeLevel >= 0) {
      this.scopes[this.scopeLevel].first = idx
    }
    this.scopeFirst = idx
    return idx
  }

  /**
   * 查找顶层变量或参数。
   *
   * @source QuickJS/src/core/parser.c:1944-1951
   * @see find_var
   */
  findVar(name: JSAtom): number {
    for (let i = this.vars.length - 1; i >= 0; i -= 1) {
      const vd = this.vars[i]
      if (vd.varName === name && vd.scopeLevel === 0) return i
    }
    return -1
  }

  /**
   * 在指定作用域内查找变量。
   *
   * @source QuickJS/src/core/parser.c:1953-1966
   * @see find_var_in_scope
   */
  findVarInScope(name: JSAtom, scopeLevel: number): number {
    if (scopeLevel < 0) return -1
    let scopeIdx = this.scopes[scopeLevel].first
    while (scopeIdx >= 0) {
      const vd = this.vars[scopeIdx]
      if (vd.scopeLevel !== scopeLevel) break
      if (vd.varName === name) return scopeIdx
      scopeIdx = vd.scopeNext
    }
    return -1
  }

  /**
   * 是否为子作用域。
   *
   * @source QuickJS/src/core/parser.c:1970-1980
   * @see is_child_scope
   */
  isChildScope(scope: number, parentScope: number): boolean {
    let cursor = scope
    while (cursor >= 0) {
      if (cursor === parentScope) return true
      cursor = this.scopes[cursor].parent
    }
    return false
  }

  /**
   * 查找子作用域中的 var。
   *
   * @source QuickJS/src/core/parser.c:1983-1998
   * @see find_var_in_child_scope
   */
  findVarInChildScope(name: JSAtom, scopeLevel: number): number {
    for (let i = 0; i < this.vars.length; i += 1) {
      const vd = this.vars[i]
      if (vd.varName === name && vd.scopeLevel === 0) {
        if (this.isChildScope(vd.scopeNext, scopeLevel)) return i
      }
    }
    return -1
  }

  /**
   * 获取当前作用域链中的首个词法变量。
   *
   * @source QuickJS/src/core/parser.c:2087-2096
   * @see get_first_lexical_var
   */
  getFirstLexicalVar(scope: number): number {
    let cursor = scope
    while (cursor >= 0) {
      const first = this.scopes[cursor].first
      if (first >= 0) return first
      cursor = this.scopes[cursor].parent
    }
    return -1
  }

  /**
   * 获取状态快照。
   *
   * @source QuickJS/src/core/parser.c:2050-2165
   * @see push_scope
   */
  snapshot(): ScopeManagerState {
    return {
      vars: [...this.vars],
      scopes: [...this.scopes],
      scopeLevel: this.scopeLevel,
      scopeFirst: this.scopeFirst,
    }
  }
}
