import assert from 'node:assert/strict'
import test from 'node:test'

import { QuickJSLib } from '../../../scripts/QuickJSLib'
import { AtomTable } from '../atom-table'


test('atom: preload aligns with wasm environment atoms', async () => {
  const wasmAtoms = await QuickJSLib.getEnvironmentAtoms()
  const table = new AtomTable({
    preloadBuiltins: false,
    preload: wasmAtoms.map(atom => ({ id: atom.id, name: atom.key })),
  })

  const entries = table.getAllAtoms().map(atom => ({ id: atom.id, name: atom.name }))
  const expected = wasmAtoms.map(atom => ({ id: atom.id, name: atom.key }))

  assert.deepEqual(entries, expected)
})
