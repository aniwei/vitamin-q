import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'

import { parseSource } from '../../ast/parser'
import { BytecodeCompiler } from '../emitter'
import { AtomTable } from '../atom-table'
import { Opcode, TempOpcode } from '../../env'

const compileExpression = (code: string, atomTable?: AtomTable) => {
  const source = parseSource(code, { fileName: 'expr.ts' })
  const compiler = new BytecodeCompiler({ atomTable })
  const buffer = compiler.compile(source)
  return buffer.toUint8Array()
}

const withLineInfo = (bytes: number[]) => [
  TempOpcode.OP_line_num,
  0, 0, 0, 0,
  ...bytes,
]

test('emitter: numeric literal pushes i32', () => {
  const bytes = compileExpression('1;')
  assert.deepEqual(Array.from(bytes), withLineInfo([Opcode.OP_push_i32, 1, 0, 0, 0]))
})

test('emitter: binary add emits OP_add', () => {
  const bytes = compileExpression('1 + 2;')
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_push_i32, 1, 0, 0, 0,
    Opcode.OP_push_i32, 2, 0, 0, 0,
    Opcode.OP_add,
  ]))
})

test('emitter: unary neg emits OP_neg', () => {
  const bytes = compileExpression('-1;')
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_push_i32, 1, 0, 0, 0,
    Opcode.OP_neg,
  ]))
})

test('emitter: string literal uses atom table', () => {
  const atoms = new AtomTable()
  const expectedId = atoms.getOrAdd('hello')
  const bytes = compileExpression('"hello";', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_push_atom_value,
    expectedId & 0xff,
    (expectedId >>> 8) & 0xff,
    (expectedId >>> 16) & 0xff,
    (expectedId >>> 24) & 0xff,
  ]))
})

test('emitter: boolean and null literals', () => {
  const trueBytes = compileExpression('true;')
  const falseBytes = compileExpression('false;')
  const nullBytes = compileExpression('null;')

  assert.deepEqual(Array.from(trueBytes), withLineInfo([Opcode.OP_push_true]))
  assert.deepEqual(Array.from(falseBytes), withLineInfo([Opcode.OP_push_false]))
  assert.deepEqual(Array.from(nullBytes), withLineInfo([Opcode.OP_null]))
})
