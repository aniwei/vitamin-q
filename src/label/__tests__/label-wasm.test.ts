import assert from 'node:assert/strict'
import test from 'node:test'

import { QuickJSLib } from '../../../scripts/QuickJSLib'
import { Opcode } from '../../env'
import { BytecodeBuffer } from '../../emitter/bytecode-buffer'
import { LabelManager } from '../label-manager'

const mapLabelSlots = (slots: ReturnType<LabelManager['getSlots']>) => slots.map(slot => ({
  refCount: slot.refCount,
  pos: slot.pos,
  pos2: slot.pos2,
  addr: slot.addr,
  firstReloc: slot.firstReloc ? slot.firstReloc.addr : -1,
}))


test('label: LabelManager aligns with wasm scenario', async () => {
  const buffer = new BytecodeBuffer()
  const labels = new LabelManager({
    emitOp: (opcode) => buffer.writeU8(opcode),
    emitU32: (value) => buffer.writeU32(value),
    getBytecodeSize: () => buffer.length,
  })

  const labelA = labels.newLabel()
  const labelB = labels.emitGoto(Opcode.OP_goto, -1)
  labels.emitLabel(labelA)
  labels.emitGoto(Opcode.OP_goto, labelA)
  labels.emitGoto(Opcode.OP_goto, labelB)
  labels.emitLabel(labelB)

  const wasm = await QuickJSLib.getLabelManagerScenario()
  assert.equal(buffer.length, wasm.bytecodeSize)
  assert.deepEqual(mapLabelSlots(labels.getSlots()), wasm.slots)
})
