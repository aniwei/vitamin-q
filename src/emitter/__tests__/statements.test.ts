import assert from 'node:assert/strict'
import test from 'node:test'

import { parseSource } from '../../ast/parser'
import { BytecodeCompiler } from '../emitter'
import { AtomTable } from '../atom-table'
import { Opcode, TempOpcode } from '../../env'

const compileStatements = (code: string, atomTable?: AtomTable) => {
  const source = parseSource(code, { fileName: 'stmt.ts' })
  const compiler = new BytecodeCompiler({ atomTable })
  const buffer = compiler.compile(source)
  return buffer.toUint8Array()
}

const withLineInfo = (bytes: number[]) => [
  TempOpcode.OP_line_num,
  0, 0, 0, 0,
  ...bytes,
]

test('statement: variable declaration emits OP_put_var', () => {
  const atoms = new AtomTable()
  const name = atoms.getOrAdd('a')
  const bytes = compileStatements('let a = 1;', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_push_i32, 1, 0, 0, 0,
    Opcode.OP_put_var,
    name & 0xff,
    (name >>> 8) & 0xff,
    (name >>> 16) & 0xff,
    (name >>> 24) & 0xff,
  ]))
})

test('statement: if statement emits labels', () => {
  const atoms = new AtomTable()
  const a = atoms.getOrAdd('a')
  const b = atoms.getOrAdd('b')
  const bytes = compileStatements('if (a) b;', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    a & 0xff,
    (a >>> 8) & 0xff,
    (a >>> 16) & 0xff,
    (a >>> 24) & 0xff,
    Opcode.OP_if_false,
    0, 0, 0, 0,
    TempOpcode.OP_line_num,
    7, 0, 0, 0,
    Opcode.OP_get_var,
    b & 0xff,
    (b >>> 8) & 0xff,
    (b >>> 16) & 0xff,
    (b >>> 24) & 0xff,
    TempOpcode.OP_label,
    0, 0, 0, 0,
  ]))
})

test('statement: if-else emits labels', () => {
  const atoms = new AtomTable()
  const a = atoms.getOrAdd('a')
  const b = atoms.getOrAdd('b')
  const c = atoms.getOrAdd('c')
  const bytes = compileStatements('if (a) b; else c;', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    a & 0xff,
    (a >>> 8) & 0xff,
    (a >>> 16) & 0xff,
    (a >>> 24) & 0xff,
    Opcode.OP_if_false,
    0, 0, 0, 0,
    TempOpcode.OP_line_num,
    7, 0, 0, 0,
    Opcode.OP_get_var,
    b & 0xff,
    (b >>> 8) & 0xff,
    (b >>> 16) & 0xff,
    (b >>> 24) & 0xff,
    Opcode.OP_goto,
    1, 0, 0, 0,
    TempOpcode.OP_label,
    0, 0, 0, 0,
    TempOpcode.OP_line_num,
    15, 0, 0, 0,
    Opcode.OP_get_var,
    c & 0xff,
    (c >>> 8) & 0xff,
    (c >>> 16) & 0xff,
    (c >>> 24) & 0xff,
    TempOpcode.OP_label,
    1, 0, 0, 0,
  ]))
})

test('statement: return emits OP_return', () => {
  const atoms = new AtomTable()
  const a = atoms.getOrAdd('a')
  const bytes = compileStatements('return a;', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    a & 0xff,
    (a >>> 8) & 0xff,
    (a >>> 16) & 0xff,
    (a >>> 24) & 0xff,
    Opcode.OP_return,
  ]))
})

test('statement: throw emits OP_throw', () => {
  const atoms = new AtomTable()
  const a = atoms.getOrAdd('a')
  const bytes = compileStatements('throw a;', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    a & 0xff,
    (a >>> 8) & 0xff,
    (a >>> 16) & 0xff,
    (a >>> 24) & 0xff,
    Opcode.OP_throw,
  ]))
})
