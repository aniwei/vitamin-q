import type { JSAtom } from '../env'

export interface InlineCacheSlot {
  atom: JSAtom
  index: number
}

export interface InlineCacheSnapshot {
  count: number
  slots: InlineCacheSlot[]
}

/**
 * Inline Cache 管理器（对应 add_ic_slot1）。
 *
 * @source QuickJS/src/core/ic.h:69-107
 * @see add_ic_slot1
 */
export class InlineCacheManager {
  private atomToIndex = new Map<JSAtom, number>()
  private slots: InlineCacheSlot[] = []

  /**
   * 添加 IC 槽（去重）。
   *
   * @source QuickJS/src/core/ic.h:69-107
   * @see add_ic_slot1
   */
  addSlot1(atom: JSAtom): number {
    const existing = this.atomToIndex.get(atom)
    if (existing !== undefined) return existing

    const index = this.slots.length
    this.slots.push({ atom, index })
    this.atomToIndex.set(atom, index)
    return index
  }

  /**
   * 获取槽位数量。
   *
   * @source QuickJS/src/core/ic.h:69-107
   * @see add_ic_slot1
   */
  get count() {
    return this.slots.length
  }

  /**
   * 获取 IC 快照。
   *
   * @source QuickJS/src/core/ic.h:69-107
   * @see add_ic_slot1
   */
  snapshot(): InlineCacheSnapshot {
    return { count: this.slots.length, slots: [...this.slots] }
  }

  /**
   * 重置所有槽位。
   *
   * @source QuickJS/src/core/ic.h:69-107
   * @see add_ic_slot1
   */
  reset() {
    this.atomToIndex.clear()
    this.slots = []
  }
}
