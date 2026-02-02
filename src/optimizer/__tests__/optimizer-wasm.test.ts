import assert from 'node:assert/strict'
import test from 'node:test'

import { QuickJSLib } from '../../../scripts/QuickJSLib'
import { peepholeOptimize } from '../peephole'
import { convertShortOpcodes } from '../short-opcodes'
import { eliminateDeadCode } from '../dead-code'


test('optimizer: peephole aligns with wasm', async () => {
  const input = Uint8Array.from([1, 2, 3, 4])
  const wasm = await QuickJSLib.optimizePeephole(input)
  const ours = peepholeOptimize(input)
  assert.deepEqual(Array.from(ours), Array.from(wasm))
})

test('optimizer: short opcode aligns with wasm', async () => {
  const input = Uint8Array.from([10, 20, 30])
  const wasm = await QuickJSLib.optimizeShortOpcodes(input)
  const ours = convertShortOpcodes(input)
  assert.deepEqual(Array.from(ours), Array.from(wasm))
})

test('optimizer: dead code aligns with wasm', async () => {
  const input = Uint8Array.from([9, 8, 7])
  const wasm = await QuickJSLib.optimizeDeadCode(input)
  const ours = eliminateDeadCode(input)
  assert.deepEqual(Array.from(ours), Array.from(wasm))
})
