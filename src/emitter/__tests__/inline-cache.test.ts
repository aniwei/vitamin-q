import assert from 'node:assert/strict'
import test from 'node:test'

import { QuickJSLib } from '../../../scripts/QuickJSLib'
import { InlineCacheManager } from '../inline-cache'

test('inline-cache: addSlot1 aligns with wasm add_ic_slot1', async () => {
  const atoms = [10, 20, 10, 30, 20]
  const manager = new InlineCacheManager()
  const results = atoms.map(atom => manager.addSlot1(atom))

  const wasm = await QuickJSLib.getInlineCacheAddResult(atoms)
  assert.deepEqual(results, wasm.results)
  assert.equal(manager.count, wasm.count)
})