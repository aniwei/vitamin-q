import assert from 'node:assert/strict'
import test from 'node:test'

import { QuickJSLib } from '../../../scripts/QuickJSLib'
import { BytecodeTag } from '../../env'
import { createWriterState, toUint8Array } from '../bytecode-writer'
import { JS_WriteObjectRec } from '../value-writer'

const getEnumMap = (enumObj: Record<string, number | string>) => Object.fromEntries(
  Object.entries(enumObj)
    .filter(([key, value]) => typeof value === 'number' && Number.isNaN(Number(key)))
    .map(([key, value]) => [key, value as number]),
)


test('serializer: BytecodeTag aligns with wasm', async () => {
  const wasm = await QuickJSLib.getAllBytecodeTags()
  const local = getEnumMap(BytecodeTag)
  const localKeys = Object.keys(local).sort()
  const wasmKeys = Object.keys(wasm).sort()
  assert.deepEqual(localKeys, wasmKeys)
  for (const key of localKeys) {
    assert.equal(local[key], wasm[key])
  }
})

test('serializer: wasm scenario aligns with value writer', async () => {
  const writer = createWriterState()
  JS_WriteObjectRec(writer, 'a')
  const ours = toUint8Array(writer)
  const wasm = await QuickJSLib.getSerializerScenario()
  assert.deepEqual(Array.from(ours), Array.from(wasm))
})
