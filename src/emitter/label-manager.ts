import { TempOpcode } from '../env'
import type { LabelSlot } from '../types/function-def'

export interface LabelManagerCallbacks {
  emitOp: (opcode: number) => void
  emitU32: (value: number) => void
  getBytecodeSize: () => number
  isLiveCode?: () => boolean
}

/**
 * 标签管理器（对应 new_label/emit_label/emit_goto）。
 *
 * @source QuickJS/src/core/parser.c:1835-1884
 * @see new_label
 */
export class LabelManager {
  private slots: LabelSlot[] = []
  private callbacks: LabelManagerCallbacks

  constructor(callbacks: LabelManagerCallbacks) {
    this.callbacks = callbacks
  }

  /**
   * 新建标签。
   *
   * @source QuickJS/src/core/parser.c:1835-1858
   * @see new_label
   */
  newLabel(): number {
    const label = this.slots.length
    this.slots.push({
      refCount: 0,
      pos: -1,
      pos2: -1,
      addr: -1,
      firstReloc: null,
    })
    return label
  }

  /**
   * 发射标签。
   *
   * @source QuickJS/src/core/parser.c:1866-1877
   * @see emit_label
   */
  emitLabel(label: number): number {
    if (label < 0) return -1
    this.callbacks.emitOp(TempOpcode.OP_label)
    this.callbacks.emitU32(label)
    const end = this.callbacks.getBytecodeSize()
    this.slots[label].pos = end
    return end - 4
  }

  /**
   * 发射跳转。
   *
   * @source QuickJS/src/core/parser.c:1878-1884
   * @see emit_goto
   */
  emitGoto(opcode: number, label: number): number {
    if (this.callbacks.isLiveCode && !this.callbacks.isLiveCode()) return -1
    let target = label
    if (target < 0) {
      target = this.newLabel()
    }
    this.callbacks.emitOp(opcode)
    this.callbacks.emitU32(target)
    this.slots[target].refCount += 1
    return target
  }

  /**
   * 获取当前标签槽数组。
   *
   * @source QuickJS/src/core/parser.c:1835-1858
   * @see new_label
   */
  getSlots(): LabelSlot[] {
    return this.slots
  }
}
