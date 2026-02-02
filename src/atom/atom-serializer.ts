import type { AtomTable } from './atom-table'
import type { JSAtom } from '../types/function-def'

export interface AtomSnapshot {
  atoms: Array<{ id: JSAtom; name: string; refCount: number; isStatic: boolean }>
}

/**
 * Atom 序列化辅助。
 *
 * @source QuickJS/src/core/string-utils.c:417-690
 * @see __JS_NewAtom
 */
export const serializeAtoms = (table: AtomTable): AtomSnapshot => ({
  atoms: table.getAllAtoms().map(entry => ({
    id: entry.id,
    name: entry.name,
    refCount: entry.refCount,
    isStatic: entry.isStatic,
  })),
})

/**
 * Atom 反序列化辅助。
 *
 * @source QuickJS/src/core/string-utils.c:417-690
 * @see __JS_NewAtom
 */
export const hydrateAtoms = (table: AtomTable, snapshot: AtomSnapshot) => {
  for (const entry of snapshot.atoms) {
    if (table.hasAtom(entry.id)) continue
    ;(table as unknown as { insert: (id: JSAtom, name: string, isStatic: boolean) => void }).insert(
      entry.id,
      entry.name,
      entry.isStatic,
    )
  }
}
