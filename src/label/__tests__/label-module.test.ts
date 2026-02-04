import assert from 'node:assert/strict'
import test from 'node:test'

import { Opcode, TempOpcode } from '../../env'
import { LabelResolver, stripTempOpcodes } from '../label-resolver'


test('label: resolver replaces label indices', () => {
  const buffer = Uint8Array.from([
    Opcode.OP_goto, 0, 0, 0, 0,
    TempOpcode.OP_label, 0, 0, 0, 0,
  ])
  const resolver = new LabelResolver()
  const resolved = resolver.resolve(buffer, [{ refCount: 0, pos: 10, pos2: -1, addr: -1, firstReloc: null }])
  assert.equal(resolved[0], Opcode.OP_goto)
  assert.equal(resolved[1], 4)
})

test('label: strip temp opcodes', () => {
  const buffer = Uint8Array.from([
    TempOpcode.OP_line_num, 1, 0, 0, 0,
    TempOpcode.OP_label, 0, 0, 0, 0,
    Opcode.OP_goto, 0, 0, 0, 0,
  ])
  const stripped = stripTempOpcodes(buffer)
  assert.deepEqual(Array.from(stripped), [Opcode.OP_goto, 0, 0, 0, 0])
})
