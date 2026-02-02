import assert from 'node:assert/strict'
import test from 'node:test'

import { PC2Line } from '../../env'
import { QuickJSLib } from '../../../scripts/QuickJSLib'

const extractPc2LineEnum = (): Record<string, number> => {
  const map: Record<string, number> = {}
  for (const [key, value] of Object.entries(PC2Line)) {
    if (typeof value === 'number') {
      map[key] = value
    }
  }
  return map
}

test('debug: pc2line enum aligns with wasm', async () => {
  const wasm = await QuickJSLib.getPC2LineCodes()
  const local = extractPc2LineEnum()

  for (const [key, value] of Object.entries(local)) {
    assert.equal(wasm[key], value, `pc2line ${key} mismatch: ours=${value} wasm=${wasm[key]}`)
  }
})
