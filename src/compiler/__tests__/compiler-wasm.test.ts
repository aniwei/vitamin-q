import assert from 'node:assert/strict'
import test from 'node:test'

import { compile } from '../../compiler'
import { QuickJSLib } from '../../../scripts/QuickJSLib'


test('compiler: wasm scenario aligns with empty source', async () => {
  const result = compile('')
  const wasm = await QuickJSLib.getCompilerScenario()
  assert.deepEqual(Array.from(result.bytecode), Array.from(wasm))
})
