import assert from 'node:assert/strict'
import test from 'node:test'

import { peepholeOptimize } from '../peephole'
import { convertShortOpcodes } from '../short-opcodes'
import { eliminateDeadCode } from '../dead-code'


test('optimizer: peephole is identity', () => {
  const buf = Uint8Array.from([1, 2, 3])
  assert.equal(peepholeOptimize(buf), buf)
})

test('optimizer: short opcode is identity', () => {
  const buf = Uint8Array.from([1, 2, 3])
  assert.equal(convertShortOpcodes(buf), buf)
})

test('optimizer: dead code is identity', () => {
  const buf = Uint8Array.from([1, 2, 3])
  assert.equal(eliminateDeadCode(buf), buf)
})
