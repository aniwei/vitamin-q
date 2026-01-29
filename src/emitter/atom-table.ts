import { JSAtom, JS_ATOM_NULL } from '../env'

export interface AtomEntry {
  id: JSAtom
  name: string
  refCount: number
  isStatic: boolean
}

export interface AtomTableOptions {
  preloadBuiltins?: boolean
  firstDynamicAtomId?: number
  preload?: Array<{ id: JSAtom; name: string }>
}

const atomKeyToString = (key: string): string => {
  if (!key.startsWith('JS_ATOM_')) return key
  const raw = key.slice('JS_ATOM_'.length)
  if (raw === 'empty_string') return ''
  return raw
}

const getBuiltinAtoms = (): Array<{ id: JSAtom; name: string }> => {
  const entries: Array<{ id: JSAtom; name: string }> = []
  for (const [key, value] of Object.entries(JSAtom)) {
    if (typeof value !== 'number') continue
    if (!key.startsWith('JS_ATOM_')) continue
    entries.push({ id: value as JSAtom, name: atomKeyToString(key) })
  }
  return entries
}

/**
 * 原子表（对应 QuickJS Atom 表）。
 *
 * @source QuickJS/src/core/string-utils.c:417-690
 * @see __JS_NewAtom
 */
export class AtomTable {
  private idToEntry = new Map<JSAtom, AtomEntry>()
  private nameToId = new Map<string, JSAtom>()
  private nextId: JSAtom

  constructor(options: AtomTableOptions = {}) {
    const builtins = options.preloadBuiltins ?? true
    const builtinAtoms = builtins ? getBuiltinAtoms() : []
    const preload = options.preload ?? []

    let maxId = JS_ATOM_NULL
    for (const { id } of [...builtinAtoms, ...preload]) {
      if (id > maxId) maxId = id
    }

    this.nextId = options.firstDynamicAtomId ?? (maxId + 1)

    if (builtins) {
      for (const atom of builtinAtoms) {
        this.insert(atom.id, atom.name, true)
      }
    }

    for (const atom of preload) {
      this.insert(atom.id, atom.name, true)
    }
  }

  /**
   * 获取或创建原子。
   *
   * @source QuickJS/src/core/string-utils.c:577-590
   * @see __JS_NewAtomInit
   */
  getOrAdd(name: string): JSAtom {
    const existing = this.nameToId.get(name)
    if (existing !== undefined) {
      this.dupAtom(existing)
      return existing
    }

    const id = this.nextId++
    this.insert(id, name, false)
    return id
  }

  /**
   * 复制原子引用计数。
   *
   * @source QuickJS/src/core/string-utils.c:220-238
   * @see JS_DupAtom
   */
  dupAtom(atom: JSAtom): JSAtom {
    const entry = this.idToEntry.get(atom)
    if (entry) entry.refCount += 1
    return atom
  }

  /**
   * 释放原子引用计数。
   *
   * @source QuickJS/src/core/string-utils.c:610-690
   * @see __JS_FreeAtom
   */
  freeAtom(atom: JSAtom) {
    const entry = this.idToEntry.get(atom)
    if (!entry || entry.isStatic) return
    entry.refCount = Math.max(0, entry.refCount - 1)
    if (entry.refCount === 0) {
      this.idToEntry.delete(atom)
      this.nameToId.delete(entry.name)
    }
  }

  /**
   * 获取原子对应的字符串。
   *
   * @source QuickJS/src/core/string-utils.c:417-590
   * @see __JS_NewAtom
   */
  getAtomName(atom: JSAtom): string | undefined {
    return this.idToEntry.get(atom)?.name
  }

  /**
   * 判断是否存在原子。
   *
   * @source QuickJS/src/core/string-utils.c:417-590
   * @see __JS_NewAtom
   */
  hasAtom(atom: JSAtom): boolean {
    return this.idToEntry.has(atom)
  }

  /**
   * 获取原子引用计数。
   *
   * @source QuickJS/src/core/string-utils.c:610-690
   * @see __JS_FreeAtom
   */
  getRefCount(atom: JSAtom): number {
    return this.idToEntry.get(atom)?.refCount ?? 0
  }

  /**
   * 获取全部原子条目。
   *
   * @source QuickJS/src/core/string-utils.c:417-590
   * @see __JS_NewAtom
   */
  getAllAtoms(): AtomEntry[] {
    return [...this.idToEntry.values()].sort((a, b) => a.id - b.id)
  }

  private insert(id: JSAtom, name: string, isStatic: boolean) {
    this.idToEntry.set(id, { id, name, refCount: isStatic ? 1 : 0, isStatic })
    this.nameToId.set(name, id)
  }
}
