import assert from 'node:assert/strict'
import test from 'node:test'

import { QuickJSLib } from '../../../scripts/QuickJSLib'
import { ConstantPoolManager } from '../constant-pool'
import { InlineCacheManager } from '../inline-cache'
import { LabelManager } from '../label-manager'
import { ScopeManager } from '../scope-manager'
import { BytecodeBuffer } from '../bytecode-buffer'
import { JSVarKindEnum, Opcode } from '../../env'

const mapLabelSlots = (slots: ReturnType<LabelManager['getSlots']>) => slots.map(slot => ({
  refCount: slot.refCount,
  pos: slot.pos,
  pos2: slot.pos2,
  addr: slot.addr,
  firstReloc: slot.firstReloc ? slot.firstReloc.addr : -1,
}))

test('manager: ConstantPoolManager aligns with wasm', async () => {
  const values = [1, 2, 1, 3]
  const manager = new ConstantPoolManager()
  const indices = values.map(value => manager.add(value))

  const wasm = await QuickJSLib.getConstantPoolAddResult(values)
  assert.deepEqual(indices, wasm.indices)
  assert.equal(manager.size, wasm.count)
})

test('manager: InlineCacheManager aligns with wasm', async () => {
  const atoms = [10, 20, 10, 30]
  const manager = new InlineCacheManager()
  const results = atoms.map(atom => manager.addSlot1(atom))

  const wasm = await QuickJSLib.getInlineCacheAddResult(atoms)
  assert.deepEqual(results, wasm.results)
  assert.equal(manager.count, wasm.count)
})

test('manager: LabelManager aligns with wasm scenario', async () => {
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

test('manager: ScopeManager aligns with wasm scenario', async () => {
  const atomA = 100
  const atomB = 200
  const atomC = 300
  const kindA = JSVarKindEnum.JS_VAR_FUNCTION_DECL
  const kindB = JSVarKindEnum.JS_VAR_CATCH
  const kindC = JSVarKindEnum.JS_VAR_NORMAL

  const manager = new ScopeManager()
  manager.pushScope()
  manager.addScopeVar(atomA, kindA)
  manager.pushScope()
  manager.addScopeVar(atomB, kindB)
  manager.popScope()
  manager.addScopeVar(atomC, kindC)

  const wasm = await QuickJSLib.getScopeManagerScenario(atomA, atomB, atomC, kindA, kindB, kindC)
  const snapshot = manager.snapshot()
  const vars = snapshot.vars.map(v => ({
    varName: v.varName,
    scopeLevel: v.scopeLevel,
    scopeNext: v.scopeNext,
    varKind: v.varKind,
  }))
  const scopes = snapshot.scopes.map(s => ({ parent: s.parent, first: s.first }))

  assert.deepEqual(vars, wasm.vars)
  assert.deepEqual(scopes, wasm.scopes)
  assert.equal(snapshot.scopeLevel, wasm.scopeLevel)
  assert.equal(snapshot.scopeFirst, wasm.scopeFirst)
})
