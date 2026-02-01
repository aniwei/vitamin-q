import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'

import { parseSource } from '../../ast/parser'
import { BytecodeCompiler } from '../emitter'
import { AtomTable } from '../atom-table'
import { COPY_DATA_PROPERTIES_OPERAND_SPREAD, Opcode, TempOpcode, OPSpecialObjectEnum } from '../../env'

const compileExpression = (code: string, atomTable?: AtomTable) => {
  const source = parseSource(code, { fileName: 'expr.ts' })
  const compiler = new BytecodeCompiler({ atomTable })
  const buffer = compiler.compile(source)
  return buffer.toUint8Array()
}

const compileExpressionWithOptions = (
  code: string,
  options: Parameters<typeof parseSource>[1],
  atomTable?: AtomTable,
) => {
  const source = parseSource(code, { fileName: 'expr.mjs', languageVersion: ts.ScriptTarget.ESNext, ...options })
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

test('emitter: identifier uses OP_get_var', () => {
  const atoms = new AtomTable()
  const id = atoms.getOrAdd('foo')
  const bytes = compileExpression('foo;', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    id & 0xff,
    (id >>> 8) & 0xff,
    (id >>> 16) & 0xff,
    (id >>> 24) & 0xff,
  ]))
})

test('emitter: this expression', () => {
  const bytes = compileExpression('this;')
  assert.deepEqual(Array.from(bytes), withLineInfo([Opcode.OP_push_this]))
})

test('emitter: property access emits OP_get_field', () => {
  const atoms = new AtomTable()
  const obj = atoms.getOrAdd('obj')
  const prop = atoms.getOrAdd('value')
  const bytes = compileExpression('obj.value;', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    obj & 0xff,
    (obj >>> 8) & 0xff,
    (obj >>> 16) & 0xff,
    (obj >>> 24) & 0xff,
    Opcode.OP_get_field,
    prop & 0xff,
    (prop >>> 8) & 0xff,
    (prop >>> 16) & 0xff,
    (prop >>> 24) & 0xff,
  ]))
})

test('emitter: call expression emits OP_call', () => {
  const atoms = new AtomTable()
  const fn = atoms.getOrAdd('fn')
  const bytes = compileExpression('fn(1, 2);', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    fn & 0xff,
    (fn >>> 8) & 0xff,
    (fn >>> 16) & 0xff,
    (fn >>> 24) & 0xff,
    Opcode.OP_push_i32, 1, 0, 0, 0,
    Opcode.OP_push_i32, 2, 0, 0, 0,
    Opcode.OP_call,
    2, 0,
  ]))
})

test('emitter: method call emits OP_call_method', () => {
  const atoms = new AtomTable()
  const obj = atoms.getOrAdd('obj')
  const method = atoms.getOrAdd('method')
  const bytes = compileExpression('obj.method(1);', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    obj & 0xff,
    (obj >>> 8) & 0xff,
    (obj >>> 16) & 0xff,
    (obj >>> 24) & 0xff,
    Opcode.OP_get_field2,
    method & 0xff,
    (method >>> 8) & 0xff,
    (method >>> 16) & 0xff,
    (method >>> 24) & 0xff,
    Opcode.OP_push_i32, 1, 0, 0, 0,
    Opcode.OP_call_method,
    1, 0,
  ]))
})

test('emitter: element method call emits OP_call_method', () => {
  const atoms = new AtomTable()
  const obj = atoms.getOrAdd('obj')
  const key = atoms.getOrAdd('key')
  const bytes = compileExpression('obj[key](1);', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    obj & 0xff,
    (obj >>> 8) & 0xff,
    (obj >>> 16) & 0xff,
    (obj >>> 24) & 0xff,
    Opcode.OP_get_var,
    key & 0xff,
    (key >>> 8) & 0xff,
    (key >>> 16) & 0xff,
    (key >>> 24) & 0xff,
    Opcode.OP_get_array_el2,
    Opcode.OP_push_i32, 1, 0, 0, 0,
    Opcode.OP_call_method,
    1, 0,
  ]))
})

test('emitter: new expression emits OP_call_constructor', () => {
  const atoms = new AtomTable()
  const ctor = atoms.getOrAdd('Foo')
  const bytes = compileExpression('new Foo(1);', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    ctor & 0xff,
    (ctor >>> 8) & 0xff,
    (ctor >>> 16) & 0xff,
    (ctor >>> 24) & 0xff,
    Opcode.OP_push_i32, 1, 0, 0, 0,
    Opcode.OP_call_constructor,
    1, 0,
  ]))
})

test('emitter: conditional expression emits labels', () => {
  const atoms = new AtomTable()
  const a = atoms.getOrAdd('a')
  const b = atoms.getOrAdd('b')
  const c = atoms.getOrAdd('c')
  const bytes = compileExpression('a ? b : c;', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    a & 0xff,
    (a >>> 8) & 0xff,
    (a >>> 16) & 0xff,
    (a >>> 24) & 0xff,
    Opcode.OP_if_false,
    0, 0, 0, 0,
    Opcode.OP_get_var,
    b & 0xff,
    (b >>> 8) & 0xff,
    (b >>> 16) & 0xff,
    (b >>> 24) & 0xff,
    Opcode.OP_goto,
    1, 0, 0, 0,
    TempOpcode.OP_label,
    0, 0, 0, 0,
    Opcode.OP_get_var,
    c & 0xff,
    (c >>> 8) & 0xff,
    (c >>> 16) & 0xff,
    (c >>> 24) & 0xff,
    TempOpcode.OP_label,
    1, 0, 0, 0,
  ]))
})

test('emitter: logical && emits short-circuit labels', () => {
  const atoms = new AtomTable()
  const a = atoms.getOrAdd('a')
  const b = atoms.getOrAdd('b')
  const bytes = compileExpression('a && b;', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    a & 0xff,
    (a >>> 8) & 0xff,
    (a >>> 16) & 0xff,
    (a >>> 24) & 0xff,
    Opcode.OP_dup,
    Opcode.OP_if_false,
    0, 0, 0, 0,
    Opcode.OP_drop,
    Opcode.OP_get_var,
    b & 0xff,
    (b >>> 8) & 0xff,
    (b >>> 16) & 0xff,
    (b >>> 24) & 0xff,
    TempOpcode.OP_label,
    0, 0, 0, 0,
  ]))
})

test('emitter: logical || emits short-circuit labels', () => {
  const atoms = new AtomTable()
  const a = atoms.getOrAdd('a')
  const b = atoms.getOrAdd('b')
  const bytes = compileExpression('a || b;', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    a & 0xff,
    (a >>> 8) & 0xff,
    (a >>> 16) & 0xff,
    (a >>> 24) & 0xff,
    Opcode.OP_dup,
    Opcode.OP_if_true,
    0, 0, 0, 0,
    Opcode.OP_drop,
    Opcode.OP_get_var,
    b & 0xff,
    (b >>> 8) & 0xff,
    (b >>> 16) & 0xff,
    (b >>> 24) & 0xff,
    TempOpcode.OP_label,
    0, 0, 0, 0,
  ]))
})

test('emitter: nullish coalescing emits labels', () => {
  const atoms = new AtomTable()
  const a = atoms.getOrAdd('a')
  const b = atoms.getOrAdd('b')
  const bytes = compileExpression('a ?? b;', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    a & 0xff,
    (a >>> 8) & 0xff,
    (a >>> 16) & 0xff,
    (a >>> 24) & 0xff,
    Opcode.OP_dup,
    Opcode.OP_is_undefined_or_null,
    Opcode.OP_if_false,
    0, 0, 0, 0,
    Opcode.OP_drop,
    Opcode.OP_get_var,
    b & 0xff,
    (b >>> 8) & 0xff,
    (b >>> 16) & 0xff,
    (b >>> 24) & 0xff,
    TempOpcode.OP_label,
    0, 0, 0, 0,
  ]))
})

test('emitter: template expression emits concat', () => {
  const atoms = new AtomTable()
  const x = atoms.getOrAdd('x')
  const bytes = compileExpression('`hi ${x}!`;', atoms)
  const hi = atoms.getOrAdd('hi ')
  const bang = atoms.getOrAdd('!')
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_push_atom_value,
    hi & 0xff,
    (hi >>> 8) & 0xff,
    (hi >>> 16) & 0xff,
    (hi >>> 24) & 0xff,
    Opcode.OP_get_var,
    x & 0xff,
    (x >>> 8) & 0xff,
    (x >>> 16) & 0xff,
    (x >>> 24) & 0xff,
    Opcode.OP_add,
    Opcode.OP_push_atom_value,
    bang & 0xff,
    (bang >>> 8) & 0xff,
    (bang >>> 16) & 0xff,
    (bang >>> 24) & 0xff,
    Opcode.OP_add,
  ]))
})

test('emitter: import.meta emits OP_special_object', () => {
  const bytes = compileExpression('import.meta;')
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_special_object,
    OPSpecialObjectEnum.OP_SPECIAL_OBJECT_IMPORT_META,
  ]))
})

test('emitter: new.target emits OP_special_object', () => {
  const bytes = compileExpression('new.target;')
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_special_object,
    OPSpecialObjectEnum.OP_SPECIAL_OBJECT_NEW_TARGET,
  ]))
})

test('emitter: optional property access emits opt chain opcode', () => {
  const atoms = new AtomTable()
  const obj = atoms.getOrAdd('obj')
  const prop = atoms.getOrAdd('value')
  const bytes = compileExpression('obj?.value;', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    obj & 0xff,
    (obj >>> 8) & 0xff,
    (obj >>> 16) & 0xff,
    (obj >>> 24) & 0xff,
    TempOpcode.OP_get_field_opt_chain,
    prop & 0xff,
    (prop >>> 8) & 0xff,
    (prop >>> 16) & 0xff,
    (prop >>> 24) & 0xff,
  ]))
})

test('emitter: optional element access emits opt chain opcode', () => {
  const atoms = new AtomTable()
  const obj = atoms.getOrAdd('obj')
  const key = atoms.getOrAdd('key')
  const bytes = compileExpression('obj?.[key];', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    obj & 0xff,
    (obj >>> 8) & 0xff,
    (obj >>> 16) & 0xff,
    (obj >>> 24) & 0xff,
    Opcode.OP_get_var,
    key & 0xff,
    (key >>> 8) & 0xff,
    (key >>> 16) & 0xff,
    (key >>> 24) & 0xff,
    TempOpcode.OP_get_array_el_opt_chain,
  ]))
})

test('emitter: dynamic import emits OP_import', () => {
  const atoms = new AtomTable()
  const mod = atoms.getOrAdd('mod')
  const bytes = compileExpression('import("mod");', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_special_object,
    OPSpecialObjectEnum.OP_SPECIAL_OBJECT_IMPORT_META,
    Opcode.OP_push_atom_value,
    mod & 0xff,
    (mod >>> 8) & 0xff,
    (mod >>> 16) & 0xff,
    (mod >>> 24) & 0xff,
    Opcode.OP_import,
  ]))
})

test('emitter: super property access emits OP_get_super_value', () => {
  const atoms = new AtomTable()
  const prop = atoms.getOrAdd('value')
  const bytes = compileExpression('super.value;', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_super,
    Opcode.OP_push_atom_value,
    prop & 0xff,
    (prop >>> 8) & 0xff,
    (prop >>> 16) & 0xff,
    (prop >>> 24) & 0xff,
    Opcode.OP_get_super_value,
  ]))
})

test('emitter: super element access emits OP_get_super_value', () => {
  const atoms = new AtomTable()
  const key = atoms.getOrAdd('key')
  const bytes = compileExpression('super[key];', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_super,
    Opcode.OP_get_var,
    key & 0xff,
    (key >>> 8) & 0xff,
    (key >>> 16) & 0xff,
    (key >>> 24) & 0xff,
    Opcode.OP_get_super_value,
  ]))
})

test('emitter: super call emits OP_call_constructor', () => {
  const bytes = compileExpression('super(1);')
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_super,
    Opcode.OP_push_i32, 1, 0, 0, 0,
    Opcode.OP_call_constructor,
    1, 0,
  ]))
})

test('emitter: super method call emits OP_call_method', () => {
  const atoms = new AtomTable()
  const method = atoms.getOrAdd('method')
  const bytes = compileExpression('super.method(1);', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_super,
    Opcode.OP_push_atom_value,
    method & 0xff,
    (method >>> 8) & 0xff,
    (method >>> 16) & 0xff,
    (method >>> 24) & 0xff,
    Opcode.OP_get_array_el,
    Opcode.OP_push_i32, 1, 0, 0, 0,
    Opcode.OP_call_method,
    1, 0,
  ]))
})

test('emitter: optional call on property', () => {
  const atoms = new AtomTable()
  const obj = atoms.getOrAdd('obj')
  const fn = atoms.getOrAdd('fn')
  const bytes = compileExpression('obj?.fn(1);', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    obj & 0xff,
    (obj >>> 8) & 0xff,
    (obj >>> 16) & 0xff,
    (obj >>> 24) & 0xff,
    Opcode.OP_dup,
    Opcode.OP_is_undefined_or_null,
    Opcode.OP_if_false,
    1, 0, 0, 0,
    Opcode.OP_drop,
    Opcode.OP_undefined,
    Opcode.OP_goto,
    0, 0, 0, 0,
    TempOpcode.OP_label,
    1, 0, 0, 0,
    Opcode.OP_get_field2,
    fn & 0xff,
    (fn >>> 8) & 0xff,
    (fn >>> 16) & 0xff,
    (fn >>> 24) & 0xff,
    Opcode.OP_push_i32, 1, 0, 0, 0,
    Opcode.OP_call_method,
    1, 0,
    TempOpcode.OP_label,
    0, 0, 0, 0,
  ]))
})

test('emitter: optional call on value', () => {
  const atoms = new AtomTable()
  const obj = atoms.getOrAdd('obj')
  const bytes = compileExpression('obj?.(1);', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    obj & 0xff,
    (obj >>> 8) & 0xff,
    (obj >>> 16) & 0xff,
    (obj >>> 24) & 0xff,
    Opcode.OP_dup,
    Opcode.OP_is_undefined_or_null,
    Opcode.OP_if_false,
    1, 0, 0, 0,
    Opcode.OP_drop,
    Opcode.OP_undefined,
    Opcode.OP_goto,
    0, 0, 0, 0,
    TempOpcode.OP_label,
    1, 0, 0, 0,
    Opcode.OP_push_i32, 1, 0, 0, 0,
    Opcode.OP_call,
    1, 0,
    TempOpcode.OP_label,
    0, 0, 0, 0,
  ]))
})

test('emitter: assignment emits OP_put_var with value kept', () => {
  const atoms = new AtomTable()
  const name = atoms.getOrAdd('a')
  const bytes = compileExpression('a = 1;', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_push_i32, 1, 0, 0, 0,
    Opcode.OP_dup,
    Opcode.OP_put_var,
    name & 0xff,
    (name >>> 8) & 0xff,
    (name >>> 16) & 0xff,
    (name >>> 24) & 0xff,
  ]))
})

test('emitter: compound assignment on identifier', () => {
  const atoms = new AtomTable()
  const name = atoms.getOrAdd('a')
  const bytes = compileExpression('a += 2;', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    name & 0xff,
    (name >>> 8) & 0xff,
    (name >>> 16) & 0xff,
    (name >>> 24) & 0xff,
    Opcode.OP_push_i32, 2, 0, 0, 0,
    Opcode.OP_add,
    Opcode.OP_dup,
    Opcode.OP_put_var,
    name & 0xff,
    (name >>> 8) & 0xff,
    (name >>> 16) & 0xff,
    (name >>> 24) & 0xff,
  ]))
})

test('emitter: assignment on property', () => {
  const atoms = new AtomTable()
  const obj = atoms.getOrAdd('obj')
  const prop = atoms.getOrAdd('value')
  const bytes = compileExpression('obj.value = 1;', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    obj & 0xff,
    (obj >>> 8) & 0xff,
    (obj >>> 16) & 0xff,
    (obj >>> 24) & 0xff,
    Opcode.OP_push_i32, 1, 0, 0, 0,
    Opcode.OP_insert2,
    Opcode.OP_put_field,
    prop & 0xff,
    (prop >>> 8) & 0xff,
    (prop >>> 16) & 0xff,
    (prop >>> 24) & 0xff,
  ]))
})

test('emitter: compound assignment on property', () => {
  const atoms = new AtomTable()
  const obj = atoms.getOrAdd('obj')
  const prop = atoms.getOrAdd('value')
  const bytes = compileExpression('obj.value += 1;', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    obj & 0xff,
    (obj >>> 8) & 0xff,
    (obj >>> 16) & 0xff,
    (obj >>> 24) & 0xff,
    Opcode.OP_get_field2,
    prop & 0xff,
    (prop >>> 8) & 0xff,
    (prop >>> 16) & 0xff,
    (prop >>> 24) & 0xff,
    Opcode.OP_push_i32, 1, 0, 0, 0,
    Opcode.OP_add,
    Opcode.OP_insert2,
    Opcode.OP_put_field,
    prop & 0xff,
    (prop >>> 8) & 0xff,
    (prop >>> 16) & 0xff,
    (prop >>> 24) & 0xff,
  ]))
})

test('emitter: assignment on element', () => {
  const atoms = new AtomTable()
  const obj = atoms.getOrAdd('obj')
  const key = atoms.getOrAdd('key')
  const bytes = compileExpression('obj[key] = 1;', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    obj & 0xff,
    (obj >>> 8) & 0xff,
    (obj >>> 16) & 0xff,
    (obj >>> 24) & 0xff,
    Opcode.OP_get_var,
    key & 0xff,
    (key >>> 8) & 0xff,
    (key >>> 16) & 0xff,
    (key >>> 24) & 0xff,
    Opcode.OP_push_i32, 1, 0, 0, 0,
    Opcode.OP_insert3,
    Opcode.OP_put_array_el,
  ]))
})

test('emitter: compound assignment on element', () => {
  const atoms = new AtomTable()
  const obj = atoms.getOrAdd('obj')
  const key = atoms.getOrAdd('key')
  const bytes = compileExpression('obj[key] += 1;', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    obj & 0xff,
    (obj >>> 8) & 0xff,
    (obj >>> 16) & 0xff,
    (obj >>> 24) & 0xff,
    Opcode.OP_get_var,
    key & 0xff,
    (key >>> 8) & 0xff,
    (key >>> 16) & 0xff,
    (key >>> 24) & 0xff,
    Opcode.OP_get_array_el3,
    Opcode.OP_push_i32, 1, 0, 0, 0,
    Opcode.OP_add,
    Opcode.OP_insert3,
    Opcode.OP_put_array_el,
  ]))
})

test('emitter: logical && assignment on property', () => {
  const atoms = new AtomTable()
  const obj = atoms.getOrAdd('obj')
  const prop = atoms.getOrAdd('value')
  const bytes = compileExpression('obj.value &&= 1;', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    obj & 0xff,
    (obj >>> 8) & 0xff,
    (obj >>> 16) & 0xff,
    (obj >>> 24) & 0xff,
    Opcode.OP_get_field2,
    prop & 0xff,
    (prop >>> 8) & 0xff,
    (prop >>> 16) & 0xff,
    (prop >>> 24) & 0xff,
    Opcode.OP_dup,
    Opcode.OP_if_false,
    1, 0, 0, 0,
    Opcode.OP_drop,
    Opcode.OP_drop,
    Opcode.OP_push_i32, 1, 0, 0, 0,
    Opcode.OP_insert2,
    Opcode.OP_put_field,
    prop & 0xff,
    (prop >>> 8) & 0xff,
    (prop >>> 16) & 0xff,
    (prop >>> 24) & 0xff,
    Opcode.OP_goto,
    0, 0, 0, 0,
    TempOpcode.OP_label,
    1, 0, 0, 0,
    Opcode.OP_swap,
    Opcode.OP_drop,
    TempOpcode.OP_label,
    0, 0, 0, 0,
  ]))
})

test('emitter: logical ||= assignment on property', () => {
  const atoms = new AtomTable()
  const obj = atoms.getOrAdd('obj')
  const prop = atoms.getOrAdd('value')
  const bytes = compileExpression('obj.value ||= 1;', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    obj & 0xff,
    (obj >>> 8) & 0xff,
    (obj >>> 16) & 0xff,
    (obj >>> 24) & 0xff,
    Opcode.OP_get_field2,
    prop & 0xff,
    (prop >>> 8) & 0xff,
    (prop >>> 16) & 0xff,
    (prop >>> 24) & 0xff,
    Opcode.OP_dup,
    Opcode.OP_if_true,
    1, 0, 0, 0,
    Opcode.OP_drop,
    Opcode.OP_drop,
    Opcode.OP_push_i32, 1, 0, 0, 0,
    Opcode.OP_insert2,
    Opcode.OP_put_field,
    prop & 0xff,
    (prop >>> 8) & 0xff,
    (prop >>> 16) & 0xff,
    (prop >>> 24) & 0xff,
    Opcode.OP_goto,
    0, 0, 0, 0,
    TempOpcode.OP_label,
    1, 0, 0, 0,
    Opcode.OP_swap,
    Opcode.OP_drop,
    TempOpcode.OP_label,
    0, 0, 0, 0,
  ]))
})

test('emitter: logical ??= assignment on property', () => {
  const atoms = new AtomTable()
  const obj = atoms.getOrAdd('obj')
  const prop = atoms.getOrAdd('value')
  const bytes = compileExpression('obj.value ??= 1;', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    obj & 0xff,
    (obj >>> 8) & 0xff,
    (obj >>> 16) & 0xff,
    (obj >>> 24) & 0xff,
    Opcode.OP_get_field2,
    prop & 0xff,
    (prop >>> 8) & 0xff,
    (prop >>> 16) & 0xff,
    (prop >>> 24) & 0xff,
    Opcode.OP_dup,
    Opcode.OP_is_undefined_or_null,
    Opcode.OP_if_true,
    1, 0, 0, 0,
    Opcode.OP_swap,
    Opcode.OP_drop,
    Opcode.OP_goto,
    0, 0, 0, 0,
    TempOpcode.OP_label,
    1, 0, 0, 0,
    Opcode.OP_drop,
    Opcode.OP_push_i32, 1, 0, 0, 0,
    Opcode.OP_insert2,
    Opcode.OP_put_field,
    prop & 0xff,
    (prop >>> 8) & 0xff,
    (prop >>> 16) & 0xff,
    (prop >>> 24) & 0xff,
    TempOpcode.OP_label,
    0, 0, 0, 0,
  ]))
})

test('emitter: logical && assignment on element', () => {
  const atoms = new AtomTable()
  const obj = atoms.getOrAdd('obj')
  const key = atoms.getOrAdd('key')
  const bytes = compileExpression('obj[key] &&= 1;', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    obj & 0xff,
    (obj >>> 8) & 0xff,
    (obj >>> 16) & 0xff,
    (obj >>> 24) & 0xff,
    Opcode.OP_get_var,
    key & 0xff,
    (key >>> 8) & 0xff,
    (key >>> 16) & 0xff,
    (key >>> 24) & 0xff,
    Opcode.OP_get_array_el3,
    Opcode.OP_dup,
    Opcode.OP_if_false,
    1, 0, 0, 0,
    Opcode.OP_drop,
    Opcode.OP_drop,
    Opcode.OP_push_i32, 1, 0, 0, 0,
    Opcode.OP_insert3,
    Opcode.OP_put_array_el,
    Opcode.OP_goto,
    0, 0, 0, 0,
    TempOpcode.OP_label,
    1, 0, 0, 0,
    Opcode.OP_rot3r,
    Opcode.OP_drop,
    Opcode.OP_drop,
    TempOpcode.OP_label,
    0, 0, 0, 0,
  ]))
})

test('emitter: logical ||= assignment on element', () => {
  const atoms = new AtomTable()
  const obj = atoms.getOrAdd('obj')
  const key = atoms.getOrAdd('key')
  const bytes = compileExpression('obj[key] ||= 1;', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    obj & 0xff,
    (obj >>> 8) & 0xff,
    (obj >>> 16) & 0xff,
    (obj >>> 24) & 0xff,
    Opcode.OP_get_var,
    key & 0xff,
    (key >>> 8) & 0xff,
    (key >>> 16) & 0xff,
    (key >>> 24) & 0xff,
    Opcode.OP_get_array_el3,
    Opcode.OP_dup,
    Opcode.OP_if_true,
    1, 0, 0, 0,
    Opcode.OP_drop,
    Opcode.OP_drop,
    Opcode.OP_push_i32, 1, 0, 0, 0,
    Opcode.OP_insert3,
    Opcode.OP_put_array_el,
    Opcode.OP_goto,
    0, 0, 0, 0,
    TempOpcode.OP_label,
    1, 0, 0, 0,
    Opcode.OP_rot3r,
    Opcode.OP_drop,
    Opcode.OP_drop,
    TempOpcode.OP_label,
    0, 0, 0, 0,
  ]))
})

test('emitter: logical ??= assignment on element', () => {
  const atoms = new AtomTable()
  const obj = atoms.getOrAdd('obj')
  const key = atoms.getOrAdd('key')
  const bytes = compileExpression('obj[key] ??= 1;', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    obj & 0xff,
    (obj >>> 8) & 0xff,
    (obj >>> 16) & 0xff,
    (obj >>> 24) & 0xff,
    Opcode.OP_get_var,
    key & 0xff,
    (key >>> 8) & 0xff,
    (key >>> 16) & 0xff,
    (key >>> 24) & 0xff,
    Opcode.OP_get_array_el3,
    Opcode.OP_dup,
    Opcode.OP_is_undefined_or_null,
    Opcode.OP_if_true,
    1, 0, 0, 0,
    Opcode.OP_rot3r,
    Opcode.OP_drop,
    Opcode.OP_drop,
    Opcode.OP_goto,
    0, 0, 0, 0,
    TempOpcode.OP_label,
    1, 0, 0, 0,
    Opcode.OP_drop,
    Opcode.OP_push_i32, 1, 0, 0, 0,
    Opcode.OP_insert3,
    Opcode.OP_put_array_el,
    TempOpcode.OP_label,
    0, 0, 0, 0,
  ]))
})

test('emitter: array literal emits OP_array_from', () => {
  const bytes = compileExpression('[1, 2];')
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_push_i32, 1, 0, 0, 0,
    Opcode.OP_push_i32, 2, 0, 0, 0,
    Opcode.OP_array_from,
    2, 0,
  ]))
})

test('emitter: object literal emits OP_define_field', () => {
  const atoms = new AtomTable()
  const a = atoms.getOrAdd('a')
  const b = atoms.getOrAdd('b')
  const bytes = compileExpression('({ a: 1, b: 2 });', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_object,
    Opcode.OP_push_i32, 1, 0, 0, 0,
    Opcode.OP_define_field,
    a & 0xff,
    (a >>> 8) & 0xff,
    (a >>> 16) & 0xff,
    (a >>> 24) & 0xff,
    Opcode.OP_push_i32, 2, 0, 0, 0,
    Opcode.OP_define_field,
    b & 0xff,
    (b >>> 8) & 0xff,
    (b >>> 16) & 0xff,
    (b >>> 24) & 0xff,
  ]))
})

test('emitter: object literal with computed name', () => {
  const atoms = new AtomTable()
  const key = atoms.getOrAdd('key')
  const bytes = compileExpression('({ [key]: 1 });', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_object,
    Opcode.OP_get_var,
    key & 0xff,
    (key >>> 8) & 0xff,
    (key >>> 16) & 0xff,
    (key >>> 24) & 0xff,
    Opcode.OP_to_propkey,
    Opcode.OP_push_i32, 1, 0, 0, 0,
    Opcode.OP_define_array_el,
    Opcode.OP_drop,
  ]))
})

test('emitter: object literal shorthand property', () => {
  const atoms = new AtomTable()
  const a = atoms.getOrAdd('a')
  const bytes = compileExpression('({ a });', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_object,
    Opcode.OP_get_var,
    a & 0xff,
    (a >>> 8) & 0xff,
    (a >>> 16) & 0xff,
    (a >>> 24) & 0xff,
    Opcode.OP_define_field,
    a & 0xff,
    (a >>> 8) & 0xff,
    (a >>> 16) & 0xff,
    (a >>> 24) & 0xff,
  ]))
})

test('emitter: array literal with spread', () => {
  const atoms = new AtomTable()
  const arr = atoms.getOrAdd('arr')
  const bytes = compileExpression('[1, ...arr, 2];', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_array_from, 0, 0,
    Opcode.OP_push_i32, 0, 0, 0, 0,
    Opcode.OP_push_i32, 1, 0, 0, 0,
    Opcode.OP_define_array_el,
    Opcode.OP_inc,
    Opcode.OP_get_var,
    arr & 0xff,
    (arr >>> 8) & 0xff,
    (arr >>> 16) & 0xff,
    (arr >>> 24) & 0xff,
    Opcode.OP_append,
    Opcode.OP_push_i32, 2, 0, 0, 0,
    Opcode.OP_define_array_el,
    Opcode.OP_inc,
    Opcode.OP_drop,
  ]))
})

test('emitter: array literal with hole', () => {
  const bytes = compileExpression('[1, , 2];')
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_array_from, 0, 0,
    Opcode.OP_push_i32, 0, 0, 0, 0,
    Opcode.OP_push_i32, 1, 0, 0, 0,
    Opcode.OP_define_array_el,
    Opcode.OP_inc,
    Opcode.OP_inc,
    Opcode.OP_push_i32, 2, 0, 0, 0,
    Opcode.OP_define_array_el,
    Opcode.OP_inc,
    Opcode.OP_drop,
  ]))
})

test('emitter: object literal spread', () => {
  const atoms = new AtomTable()
  const obj = atoms.getOrAdd('obj')
  const a = atoms.getOrAdd('a')
  const bytes = compileExpression('({ ...obj, a: 1 });', atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_object,
    Opcode.OP_get_var,
    obj & 0xff,
    (obj >>> 8) & 0xff,
    (obj >>> 16) & 0xff,
    (obj >>> 24) & 0xff,
    Opcode.OP_null,
    Opcode.OP_copy_data_properties,
    COPY_DATA_PROPERTIES_OPERAND_SPREAD,
    Opcode.OP_drop,
    Opcode.OP_drop,
    Opcode.OP_push_i32, 1, 0, 0, 0,
    Opcode.OP_define_field,
    a & 0xff,
    (a >>> 8) & 0xff,
    (a >>> 16) & 0xff,
    (a >>> 24) & 0xff,
  ]))
})

test('emitter: await expression emits OP_await', () => {
  const atoms = new AtomTable()
  const foo = atoms.getOrAdd('foo')
  const bytes = compileExpressionWithOptions('await foo;', { fileName: 'expr.mjs' }, atoms)
  assert.deepEqual(Array.from(bytes), withLineInfo([
    Opcode.OP_get_var,
    foo & 0xff,
    (foo >>> 8) & 0xff,
    (foo >>> 16) & 0xff,
    (foo >>> 24) & 0xff,
    Opcode.OP_await,
  ]))
})
