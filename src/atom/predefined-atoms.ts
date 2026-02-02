import { JSAtom } from '../env'
import type { JSAtom as JSAtomId } from '../types/function-def'

export interface PredefinedAtom {
  id: JSAtomId
  name: string
}

const atomKeyToString = (key: string): string => {
  if (!key.startsWith('JS_ATOM_')) return key
  const raw = key.slice('JS_ATOM_'.length)
  if (raw === 'empty_string') return ''
  return raw
}

/**
 * 获取预定义原子列表。
 *
 * @source QuickJS/src/core/string-utils.c:417-690
 * @see __JS_NewAtom
 */
export const getPredefinedAtoms = (): PredefinedAtom[] => {
  const entries: PredefinedAtom[] = []
  for (const [key, value] of Object.entries(JSAtom)) {
    if (typeof value !== 'number') continue
    if (!key.startsWith('JS_ATOM_')) continue
    entries.push({ id: value as JSAtomId, name: atomKeyToString(key) })
  }
  return entries
}
