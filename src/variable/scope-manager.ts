import type { JSAtom, JSFunctionDef, JSVarDef, JSVarKindEnum } from '../types/function-def'

export interface ScopeConfig {
  argScopeIndex: number
  argScopeEnd: number
}

/**
 * 作用域管理（Phase 2）。
 *
 * @source parser.c: push_scope/pop_scope/add_var/add_scope_var/close_scopes
 */
export class ScopeManager {
  constructor(private readonly fd: JSFunctionDef, private readonly config: ScopeConfig) {}

  pushScope(parent: number): number {
    const index = this.fd.scopeCount
    this.fd.scopes.push({ parent, first: -1 })
    this.fd.scopeCount += 1
    return index
  }

  popScope(): void {
    if (this.fd.scopeCount > 0) {
      this.fd.scopeCount -= 1
      this.fd.scopes.pop()
    }
  }

  addVar(name: JSAtom, scopeLevel: number, varKind: JSVarKindEnum): number {
    const def: JSVarDef = {
      varName: name,
      scopeLevel,
      scopeNext: -1,
      isConst: false,
      isLexical: scopeLevel > 0,
      isCaptured: false,
      isStaticPrivate: false,
      varKind,
      funcPoolIdx: -1,
    }
    const idx = this.fd.vars.length
    this.fd.vars.push(def)
    this.fd.varCount = this.fd.vars.length
    return idx
  }

  addArg(name: JSAtom, varKind: JSVarKindEnum): number {
    const def: JSVarDef = {
      varName: name,
      scopeLevel: this.config.argScopeIndex,
      scopeNext: this.config.argScopeEnd,
      isConst: false,
      isLexical: false,
      isCaptured: false,
      isStaticPrivate: false,
      varKind,
      funcPoolIdx: -1,
    }
    const idx = this.fd.args.length
    this.fd.args.push(def)
    this.fd.argCount = this.fd.args.length
    return idx
  }

  findArg(name: JSAtom): number {
    for (let i = this.fd.argCount - 1; i >= 0; i -= 1) {
      if (this.fd.args[i].varName === name) return i
    }
    return -1
  }

  findVar(name: JSAtom): number {
    for (let i = this.fd.varCount - 1; i >= 0; i -= 1) {
      const v = this.fd.vars[i]
      if (v.varName === name && v.scopeLevel === 0) return i
    }
    return -1
  }

  closeScopes(scope: number, stop: number): void {
    if (scope <= stop) return
    for (let i = scope; i > stop; i -= 1) {
      const current = this.fd.scopes[i]
      current.first = -1
    }
  }
}
