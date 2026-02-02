import assert from 'node:assert/strict'
import test from 'node:test'

import { QuickJSLib } from '../../../scripts/QuickJSLib'
import { createBlockEnv } from '../block-env'
import { BlockManager } from '../block-manager'


test('control-flow: BlockManager aligns with wasm scenario', async () => {
  const manager = new BlockManager()
  const first = createBlockEnv({ labelName: 0 })
  const second = createBlockEnv({
    labelName: 1,
    labelBreak: 2,
    labelCont: 3,
    dropCount: 1,
    labelFinally: 4,
    scopeLevel: 1,
    hasIterator: true,
    isRegularStmt: true,
  })

  manager.push(first)
  manager.push(second)

  const entries = [first, second].map((entry, index, all) => ({
    prev: entry.prev ? all.indexOf(entry.prev) : -1,
    labelName: entry.labelName,
    labelBreak: entry.labelBreak,
    labelCont: entry.labelCont,
    dropCount: entry.dropCount,
    labelFinally: entry.labelFinally,
    scopeLevel: entry.scopeLevel,
    hasIterator: entry.hasIterator ? 1 : 0,
    isRegularStmt: entry.isRegularStmt ? 1 : 0,
  }))

  const wasm = await QuickJSLib.getBlockManagerScenario()
  assert.deepEqual(entries, wasm.entries)
  assert.equal(wasm.top, 1)
})
