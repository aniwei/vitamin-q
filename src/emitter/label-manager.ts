import type { JSFunctionDef, LabelSlot, RelocEntry } from '../types/function-def'
import { BytecodeBuffer } from './bytecode-buffer'

/**
 * 编译阶段的标签管理（Phase 1）。
 *
 * @source parser.c: new_label/emit_label/emit_goto
 */
export class LabelManager {
  constructor(private readonly fd: JSFunctionDef, private readonly bc: BytecodeBuffer) {}

  newLabel(): number {
    const label = this.fd.labelCount
    const slot: LabelSlot = {
      refCount: 0,
      pos: -1,
      pos2: -1,
      addr: -1,
      firstReloc: null,
    }
    this.fd.labelSlots.push(slot)
    this.fd.labelCount += 1
    return label
  }

  emitLabelRaw(opcode: number, label: number): void {
    this.bc.writeU8(opcode)
    this.bc.writeU32(label)
    this.fd.labelSlots[label].pos = this.bc.size
  }

  emitLabel(opcode: number, label: number): number {
    if (label < 0) return -1
    this.bc.writeU8(opcode)
    const offset = this.bc.writeU32(label)
    this.fd.labelSlots[label].pos = this.bc.size
    return offset
  }

  emitGoto(opcode: number, label?: number): number {
    const target = label ?? this.newLabel()
    this.bc.writeU8(opcode)
    this.bc.writeU32(target)
    this.fd.labelSlots[target].refCount += 1
    return target
  }

  updateLabel(label: number, delta: number): number {
    const slot = this.fd.labelSlots[label]
    slot.refCount += delta
    return slot.refCount
  }

  getLabelPos(label: number): number {
    return this.fd.labelSlots[label].pos
  }

  addReloc(label: number, addr: number, size: number): void {
    const slot = this.fd.labelSlots[label]
    const entry: RelocEntry = { addr, size, next: slot.firstReloc }
    slot.firstReloc = entry
  }
}
