import assert from 'node:assert/strict'
import test from 'node:test'

import { QuickJSLib } from '../../../scripts/QuickJSLib'
import { runBytecode } from '../runner'
import { compareBytecode } from '../comparator'
import { validateExecution } from '../execution-validator'


test('runtime: runBytecode executes wasm bytecode', async () => {
  const bytes = await QuickJSLib.compileSourceAsScript('1 + 2', 'run.js')
  const result = await runBytecode(bytes)
  assert.ok(Array.isArray(result.stdout))
  assert.ok(Array.isArray(result.stderr))
})

test('runtime: compareBytecode detects mismatch', () => {
  const diff = compareBytecode(Uint8Array.from([1, 2]), Uint8Array.from([1, 3]))
  assert.equal(diff.match, false)
  assert.equal(diff.diffIndex, 1)
})

test('runtime: validateExecution compares outputs', async () => {
  const bytes = await QuickJSLib.compileSourceAsScript('print("same")', 'exec.js')
  const result = await validateExecution(bytes, bytes)
  assert.equal(result.match, true)
})
