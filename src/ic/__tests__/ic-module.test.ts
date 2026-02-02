import assert from 'node:assert/strict'
import test from 'node:test'

import { InlineCacheManager } from '../inline-cache'
import { addSlot1 } from '../ic-ops'


test('ic: addSlot1 updates cache', () => {
  const ic = new InlineCacheManager()
  const first = addSlot1(ic, 10)
  const second = addSlot1(ic, 20)
  assert.equal(first, 0)
  assert.equal(second, 1)
  assert.equal(ic.count, 2)
})
