import assert from 'node:assert/strict'
import test from 'node:test'

import { QuickJSLib } from '../../../scripts/QuickJSLib'
import { AtomTable } from '../atom-table'
import { FIRST_ATOM_ID } from '../../env'

test('atom-table: preload aligns with wasm environment atoms', async () => {
  const wasmAtoms = await QuickJSLib.getEnvironmentAtoms()
  const table = new AtomTable({
    preloadBuiltins: false,
    preload: wasmAtoms.map(atom => ({ id: atom.id, name: atom.key })),
  })

  const entries = table.getAllAtoms().map(atom => ({ id: atom.id, name: atom.name }))
  const expected = wasmAtoms.map(atom => ({ id: atom.id, name: atom.key }))

  assert.deepEqual(entries, expected)
})

test('atom-table: builtins cover wasm atoms', async () => {
  const wasmAtoms = await QuickJSLib.getAllAtoms()
  const table = new AtomTable()
  const ids = new Set(wasmAtoms.map(atom => atom.id))

  for (const id of ids) {
    assert.equal(table.hasAtom(id), true)
  }
})

test('atom-table: first atom id aligns with wasm', async () => {
  const wasmFirst = await QuickJSLib.getFirstAtomId()
  assert.equal(FIRST_ATOM_ID, wasmFirst)
})