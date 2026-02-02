import type { JSAtom as JSAtomId, JSGlobalVar } from '../types/function-def'
import { createGlobalVar } from './global-var'

/**
 * 全局变量管理。
 *
 * @source QuickJS/src/core/parser.c:12270-12340
 * @see add_global_var
 */
export class GlobalVarManager {
  private globals: JSGlobalVar[] = []

  add(atom: JSAtomId, options: Partial<Omit<JSGlobalVar, 'varName'>> = {}) {
    const entry = createGlobalVar(atom, options)
    this.globals.push(entry)
    return entry
  }

  find(atom: JSAtomId): JSGlobalVar | undefined {
    return this.globals.find(entry => entry.varName === atom)
  }

  all(): JSGlobalVar[] {
    return [...this.globals]
  }
}
