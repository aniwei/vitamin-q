import type { JSGlobalVar, JSAtom as JSAtomId } from '../types/function-def'

/**
 * JSGlobalVar 结构构造器。
 *
 * @source QuickJS/src/core/parser.h:153-170
 */
export const createGlobalVar = (
  atom: JSAtomId,
  options: Partial<Omit<JSGlobalVar, 'varName'>> = {},
): JSGlobalVar => ({
  varName: atom,
  cpoolIdx: options.cpoolIdx ?? -1,
  forceInit: options.forceInit ?? false,
  isLexical: options.isLexical ?? false,
  isConst: options.isConst ?? false,
  scopeLevel: options.scopeLevel ?? 0,
})
