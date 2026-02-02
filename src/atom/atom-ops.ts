import type { JSAtom } from '../types/function-def'
import { AtomTable } from './atom-table'

/**
 * Atom 操作封装。
 *
 * @source QuickJS/src/core/string-utils.c:220-690
 */
export const getOrAddAtom = (table: AtomTable, name: string): JSAtom => table.getOrAdd(name)

/**
 * @source QuickJS/src/core/string-utils.c:220-238
 * @see JS_DupAtom
 */
export const dupAtom = (table: AtomTable, atom: JSAtom): JSAtom => table.dupAtom(atom)

/**
 * @source QuickJS/src/core/string-utils.c:610-690
 * @see __JS_FreeAtom
 */
export const freeAtom = (table: AtomTable, atom: JSAtom) => table.freeAtom(atom)

/**
 * @source QuickJS/src/core/string-utils.c:417-590
 * @see __JS_NewAtom
 */
export const getAtomName = (table: AtomTable, atom: JSAtom): string | undefined => table.getAtomName(atom)
