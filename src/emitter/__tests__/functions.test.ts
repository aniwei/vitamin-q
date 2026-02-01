import assert from 'node:assert/strict'
import test from 'node:test'

import { parseSource } from '../../ast/parser'
import { AtomTable } from '../atom-table'
import { BytecodeCompiler } from '../emitter'
import { ConstantPoolManager } from '../constant-pool'
import { Opcode, OPCODE_BY_CODE, OPSpecialObjectEnum, TEMP_OPCODE_BY_CODE } from '../../env'

interface FunctionTemplate {
  kind: 'function'
  name?: string
  bytecode?: Uint8Array
}

const decodeOpcodes = (bytes: Uint8Array): string[] => {
  const ops: string[] = []
  let offset = 0
  while (offset < bytes.length) {
    const opcode = bytes[offset]
    const def =
      opcode === Opcode.OP_push_2
        ? { id: 'push_2', size: 1 }
        : (TEMP_OPCODE_BY_CODE[opcode] ?? OPCODE_BY_CODE[opcode])
    if (!def) throw new Error(`Unknown opcode: ${opcode}`)
    ops.push(def.id)
    offset += def.size
  }
  return ops
}

const extractSpecialObjectOperands = (bytes: Uint8Array): number[] => {
  const operands: number[] = []
  let offset = 0
  while (offset < bytes.length) {
    const opcode = bytes[offset]
    if (opcode === Opcode.OP_special_object) {
      operands.push(bytes[offset + 1])
    }
    const def =
      opcode === Opcode.OP_push_2
        ? { size: 1 }
        : (TEMP_OPCODE_BY_CODE[opcode] ?? OPCODE_BY_CODE[opcode])
    if (!def) throw new Error(`Unknown opcode: ${opcode}`)
    offset += def.size
  }
  return operands
}

const normalizeOpcodes = (ops: string[]): string[] => {
  const ignore = new Set(['line_num', 'label'])
  const shortMap: Record<string, string> = {
    scope_get_var_undef: 'push_2',
  }
  return ops
    .map(op => shortMap[op] ?? op)
    .filter(op => !ignore.has(op))
}

const extractTemplateOpcodes = (source: string, functionName: string): string[] => {
  const atomTable = new AtomTable()
  const constantPool = new ConstantPoolManager()
  const node = parseSource(source, { fileName: 'fn.ts' })
  const compiler = new BytecodeCompiler({ atomTable, constantPool })
  compiler.compile(node)

  const templates = constantPool.toArray().filter(
    (item): item is FunctionTemplate =>
      Boolean(item && typeof item === 'object' && (item as FunctionTemplate).kind === 'function'),
  )
  const template = templates.find(item => item.name === functionName)
  if (!template?.bytecode) {
    throw new Error(`未找到函数模板: ${functionName}`)
  }
  return decodeOpcodes(template.bytecode)
}

const extractTemplateBytecode = (source: string, functionName: string): Uint8Array => {
  const atomTable = new AtomTable()
  const constantPool = new ConstantPoolManager()
  const node = parseSource(source, { fileName: 'fn.ts' })
  const compiler = new BytecodeCompiler({ atomTable, constantPool })
  compiler.compile(node)

  const templates = constantPool.toArray().filter(
    (item): item is FunctionTemplate =>
      Boolean(item && typeof item === 'object' && (item as FunctionTemplate).kind === 'function'),
  )
  const template = templates.find(item => item.name === functionName)
  if (!template?.bytecode) {
    throw new Error(`未找到函数模板: ${functionName}`)
  }
  return template.bytecode
}

const extractFirstTemplateOpcodes = (source: string): string[] => {
  const atomTable = new AtomTable()
  const constantPool = new ConstantPoolManager()
  const node = parseSource(source, { fileName: 'fn.ts' })
  const compiler = new BytecodeCompiler({ atomTable, constantPool })
  compiler.compile(node)

  const templates = constantPool.toArray().filter(
    (item): item is FunctionTemplate =>
      Boolean(item && typeof item === 'object' && (item as FunctionTemplate).kind === 'function'),
  )
  const template = templates[0]
  if (!template?.bytecode) {
    throw new Error('未找到函数模板')
  }
  return decodeOpcodes(template.bytecode)
}

test('functions: expression statement drops value', () => {
  const source = 'function foo(a) { a; }'
  const ops = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
  assert.deepEqual(ops, ['get_arg', 'drop', 'return_undef'])
})

test('functions: return statement emits return', () => {
  const source = 'function foo() { return 1; }'
  const ops = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
  assert.deepEqual(ops, ['push_i32', 'return'])
})

test('functions: default parameter initializes arg', () => {
  const source = 'function foo(a = 1) { return a; }'
  const ops = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
  assert.deepEqual(ops, [
    'get_arg',
    'undefined',
    'strict_eq',
    'if_false',
    'push_i32',
    'put_arg',
    'get_arg',
    'return',
  ])
})

test('functions: rest parameter emits rest opcode', () => {
  const source = 'function foo(...args) {}'
  const ops = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
  assert.deepEqual(ops, ['rest', 'set_arg0', 'return_undef'])
})

test('functions: arguments emits special_object', () => {
  const source = 'function foo() { return arguments; }'
  const ops = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
  assert.deepEqual(ops, ['special_object', 'put_loc', 'get_loc', 'return'])
})

test('functions: this binds to local', () => {
  const source = 'function foo() { return this; }'
  const ops = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
  assert.deepEqual(ops, ['push_this', 'put_loc', 'get_loc', 'return'])
})

test('functions: arguments binds to local', () => {
  const source = 'function foo(a) { return arguments; }'
  const ops = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
  assert.deepEqual(ops, ['special_object', 'put_loc', 'get_loc', 'return'])
})

test('functions: arguments uses mapped arguments in non-strict simple params', () => {
  const source = 'function foo(a) { return arguments; }'
  const bytes = extractTemplateBytecode(source, 'foo')
  const operands = extractSpecialObjectOperands(bytes)
  assert.equal(operands[0], OPSpecialObjectEnum.OP_SPECIAL_OBJECT_MAPPED_ARGUMENTS)
})

test('functions: arguments uses normal arguments in strict mode', () => {
  const source = "function foo(a) { 'use strict'; return arguments; }"
  const bytes = extractTemplateBytecode(source, 'foo')
  const operands = extractSpecialObjectOperands(bytes)
  assert.equal(operands[0], OPSpecialObjectEnum.OP_SPECIAL_OBJECT_ARGUMENTS)
})

test('functions: arguments uses normal arguments with non-simple params', () => {
  const source = 'function foo(a = 1) { return arguments; }'
  const bytes = extractTemplateBytecode(source, 'foo')
  const operands = extractSpecialObjectOperands(bytes)
  assert.equal(operands[0], OPSpecialObjectEnum.OP_SPECIAL_OBJECT_ARGUMENTS)
})

test('functions: new.target binds to local', () => {
  const source = 'function foo() { return new.target; }'
  const ops = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
  assert.deepEqual(ops, ['special_object', 'put_loc', 'get_loc', 'return'])
})

test('functions: arrow arguments uses outer binding', () => {
  const source = 'const foo = () => arguments;'
  const ops = normalizeOpcodes(extractFirstTemplateOpcodes(source))
  assert.deepEqual(ops, ['get_var', 'return'])
})

test('functions: object destructuring parameter', () => {
  const source = 'function foo({ a }) {}'
  const ops = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
  assert.deepEqual(ops, ['get_arg', 'to_object', 'get_field2', 'put_loc', 'drop', 'return_undef'])
})

test('functions: array destructuring parameter', () => {
  const source = 'function foo([a]) {}'
  const ops = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
  assert.deepEqual(ops, ['get_arg', 'for_of_start', 'for_of_next', 'drop', 'put_loc', 'iterator_close', 'return_undef'])
})

test('functions: generator emits initial_yield and yield', () => {
  const source = 'function* foo() { yield 1; }'
  const ops = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
  assert.deepEqual(ops, [
    'initial_yield',
    'push_i32',
    'yield',
    'if_false',
    'return_async',
    'drop',
    'undefined',
    'return_async',
  ])
})

test('functions: async return emits return_async', () => {
  const source = 'async function foo() { return 1; }'
  const ops = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
  assert.deepEqual(ops, ['push_i32', 'return_async'])
})

test('functions: generator yield* emits yield_star', () => {
  const source = 'function* foo() { yield* bar; }'
  const ops = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
  assert.deepEqual(ops, [
    'initial_yield',
    'get_var',
    'for_of_start',
    'drop',
    'undefined',
    'undefined',
    'iterator_next',
    'iterator_check_object',
    'get_field2',
    'if_true',
    'yield_star',
    'dup',
    'if_true',
    'drop',
    'goto',
    'push_2',
    'strict_eq',
    'if_true',
    'iterator_call',
    'if_true',
    'iterator_check_object',
    'get_field2',
    'if_false',
    'get_field',
    'nip',
    'nip',
    'nip',
    'return_async',
    'iterator_call',
    'if_true',
    'iterator_check_object',
    'get_field2',
    'if_false',
    'goto',
    'iterator_call',
    'drop',
    'throw_error',
    'get_field',
    'nip',
    'nip',
    'nip',
    'drop',
    'undefined',
    'return_async',
  ])
})

test('functions: generator return emits return_async', () => {
  const source = 'function* foo() { return 1; }'
  const ops = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
  assert.deepEqual(ops, ['initial_yield', 'push_i32', 'return_async'])
})

test('functions: generator empty returns undefined', () => {
  const source = 'function* foo() { }'
  const ops = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
  assert.deepEqual(ops, ['initial_yield', 'undefined', 'return_async'])
})

test('functions: generator yield assigns value', () => {
  const source = 'function* foo() { const x = yield 1; return x; }'
  const ops = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
  assert.deepEqual(ops, [
    'initial_yield',
    'set_loc_uninitialized',
    'push_i32',
    'yield',
    'if_false',
    'return_async',
    'put_loc',
    'get_loc_check',
    'return_async',
  ])
})

test('functions: async generator yield* emits async_yield_star', () => {
  const source = 'async function* foo() { yield* bar; }'
  const ops = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
  assert.deepEqual(ops, [
    'initial_yield',
    'get_var',
    'for_await_of_start',
    'drop',
    'undefined',
    'undefined',
    'iterator_next',
    'await',
    'iterator_check_object',
    'get_field2',
    'if_true',
    'get_field',
    'await',
    'async_yield_star',
    'dup',
    'if_true',
    'drop',
    'goto',
    'push_2',
    'strict_eq',
    'if_true',
    'await',
    'iterator_call',
    'if_true',
    'await',
    'iterator_check_object',
    'get_field2',
    'if_false',
    'get_field',
    'nip',
    'nip',
    'nip',
    'await',
    'await',
    'return_async',
    'iterator_call',
    'if_true',
    'await',
    'iterator_check_object',
    'get_field2',
    'if_false',
    'goto',
    'iterator_call',
    'if_true',
    'await',
    'throw_error',
    'get_field',
    'nip',
    'nip',
    'nip',
    'drop',
    'undefined',
    'await',
    'return_async',
  ])
})

test('functions: async generator yield emits await/yield sequence', () => {
  const source = 'async function* foo() { yield 1; }'
  const ops = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
  assert.deepEqual(ops, [
    'initial_yield',
    'push_i32',
    'await',
    'yield',
    'if_false',
    'await',
    'await',
    'return_async',
    'drop',
    'undefined',
    'await',
    'return_async',
  ])
})

test('functions: async generator yield assignment emits await return_async', () => {
  const source = 'async function* foo() { const x = yield 1; return x; }'
  const ops = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
  assert.deepEqual(ops, [
    'initial_yield',
    'set_loc_uninitialized',
    'push_i32',
    'await',
    'yield',
    'if_false',
    'await',
    'await',
    'return_async',
    'put_loc',
    'get_loc_check',
    'await',
    'await',
    'return_async',
  ])
})

test('functions: async generator return emits await return_async', () => {
  const source = 'async function* foo() { return 1; }'
  const ops = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
  assert.deepEqual(ops, ['initial_yield', 'push_i32', 'await', 'await', 'return_async'])
})

test('functions: async generator empty returns undefined', () => {
  const source = 'async function* foo() { }'
  const ops = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
  assert.deepEqual(ops, ['initial_yield', 'undefined', 'await', 'return_async'])
})
