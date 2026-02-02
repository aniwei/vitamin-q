import assert from 'node:assert/strict'
import test from 'node:test'

import { QuickJSLib } from '../../../scripts/QuickJSLib'
import { InlineCacheManager } from '../inline-cache'
import { addSlot1 } from '../ic-ops'


test('ic: addSlot1 aligns with wasm', async () => {
  const atoms = [10, 20, 10, 30]
  const manager = new InlineCacheManager()
  const results = atoms.map(atom => addSlot1(manager, atom))

  const wasm = await QuickJSLib.getInlineCacheAddResult(atoms)
  assert.deepEqual(results, wasm.results)
  assert.equal(manager.count, wasm.count)
})
