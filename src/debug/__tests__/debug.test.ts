import assert from 'node:assert/strict'
import test from 'node:test'

import { dumpBytecode } from '../bytecode-dump'
import { PC2ColumnTable } from '../pc2column'
import { PC2LineTable } from '../pc2line'
import { SourceMapState, buildSourceMap } from '../source-map'


test('debug: pc2line resolves latest entry', () => {
  const table = new PC2LineTable()
  table.add(0, 1)
  table.add(5, 2)
  table.add(10, 3)
  assert.equal(table.getLine(7), 2)
  assert.equal(table.getLine(10), 3)
})

test('debug: pc2column resolves latest entry', () => {
  const table = new PC2ColumnTable()
  table.add(0, 10)
  table.add(3, 12)
  assert.equal(table.getColumn(2), 10)
  assert.equal(table.getColumn(3), 12)
})

test('debug: source map combines slots', () => {
  const state = new SourceMapState()
  state.addLineNumberSlot(0, 1)
  state.addColumnNumberSlot(0, 5)
  state.addLineNumberSlot(3, 2)
  const map = buildSourceMap(state)
  assert.deepEqual(map, [
    { pc: 0, line: 1, column: 5 },
    { pc: 3, line: 2, column: 0 },
  ])
})

test('debug: dump bytecode outputs hex', () => {
  const bytes = Uint8Array.from([0, 15, 255])
  const dump = dumpBytecode(bytes, { force: true })
  assert.equal(dump, '00 0f ff')
})
