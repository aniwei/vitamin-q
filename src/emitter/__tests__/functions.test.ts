import assert from 'node:assert/strict'
import test from 'node:test'

import { parseSource } from '../../ast/parser'
import { AtomTable } from '../atom-table'
import { BytecodeCompiler } from '../emitter'
import { ConstantPoolManager } from '../constant-pool'
import { OPCODE_BY_CODE, TEMP_OPCODE_BY_CODE } from '../../env'

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
    const def = TEMP_OPCODE_BY_CODE[opcode] ?? OPCODE_BY_CODE[opcode]
    if (!def) throw new Error(`Unknown opcode: ${opcode}`)
    ops.push(def.id)
    offset += def.size
  }
  return ops
}

const normalizeOpcodes = (ops: string[]): string[] => {
  const ignore = new Set(['line_num', 'label'])
  return ops.filter(op => !ignore.has(op))
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
    'dup',
    'undefined',
    'strict_eq',
    'if_false',
    'drop',
    'push_i32',
    'dup',
    'put_arg',
    'get_arg',
    'return',
  ])
})

test('functions: rest parameter emits rest opcode', () => {
  const source = 'function foo(...args) {}'
  const ops = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
  assert.deepEqual(ops, ['rest', 'put_arg', 'return_undef'])
})

test('functions: arguments emits special_object', () => {
  const source = 'function foo() { return arguments; }'
  const ops = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
  assert.deepEqual(ops, ['special_object', 'return'])
})

test('functions: object destructuring parameter', () => {
  const source = 'function foo({ a }) {}'
  const ops = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
  assert.deepEqual(ops, ['get_arg', 'to_object', 'get_field2', 'put_var_init', 'drop', 'return_undef'])
})

test('functions: array destructuring parameter', () => {
  const source = 'function foo([a]) {}'
  const ops = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
  assert.deepEqual(ops, ['get_arg', 'for_of_start', 'for_of_next', 'drop', 'put_var_init', 'iterator_close', 'return_undef'])
})

test('functions: generator emits initial_yield and yield', () => {
  const source = 'function* foo() { yield 1; }'
  const ops = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
  assert.deepEqual(ops, ['initial_yield', 'push_i32', 'yield', 'drop', 'return_undef'])
})

test('functions: async return emits return_async', () => {
  const source = 'async function foo() { return 1; }'
  const ops = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
  assert.deepEqual(ops, ['push_i32', 'return_async'])
})
