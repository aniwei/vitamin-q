import assert from 'node:assert/strict'
import test from 'node:test'

import { QuickJSLib } from '../../../scripts/QuickJSLib'
import { parseSource } from '../../ast/parser'
import { AtomTable } from '../atom-table'
import { BytecodeCompiler } from '../emitter'
import { OPCODE_BY_CODE, TEMP_OPCODE_BY_CODE } from '../../env'

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

const extractWasmOpcodes = async (source: string): Promise<string[]> => {
  const bytes = await QuickJSLib.compileSourceAsScript(source, 'stmt.js')
  const dump = await QuickJSLib.dumpBytesToString(bytes)
  const lines = dump.split('\n')
  const ops: string[] = []
  let inOpcodes = false

  for (const line of lines) {
    if (!inOpcodes) {
      if (/opcodes \(\d+ bytes\):/.test(line)) {
        inOpcodes = true
      }
      continue
    }

    const match = line.match(/^\s*\d+\s+([a-z0-9_]+)/i)
    if (match) {
      ops.push(match[1])
      continue
    }

    if (line.trim() === '' && ops.length > 0) break
  }

  return ops
}

const normalizeOpcodes = (ops: string[], options: { ignoreReturn?: boolean } = {}): string[] => {
  const ignore = new Set([
    'line_num',
    'label',
    'undefined',
    'enter_scope',
    'leave_scope',
    'check_define_var',
    'define_var',
    'get_loc',
    'get_loc0',
    'get_loc1',
    'get_loc2',
    'get_loc3',
    'put_loc',
    'put_loc0',
    'put_loc1',
    'put_loc2',
    'put_loc3',
    'set_loc0',
    'set_loc1',
    'set_loc2',
    'set_loc3',
    'set_loc',
    'dup',
    'drop',
    'swap',
    'nip',
    'rot3r',
  ])

  const shortMap: Record<string, string> = {
    push_0: 'push_i32',
    push_1: 'push_i32',
    push_2: 'push_i32',
    push_3: 'push_i32',
    push_i8: 'push_i32',
    push_const8: 'push_const',
    fclosure8: 'fclosure',
    get_loc0: 'get_loc',
    get_loc1: 'get_loc',
    get_loc2: 'get_loc',
    get_loc3: 'get_loc',
    put_loc0: 'put_loc',
    put_loc1: 'put_loc',
    put_loc2: 'put_loc',
    put_loc3: 'put_loc',
    if_true8: 'if_true',
    if_false8: 'if_false',
    goto8: 'goto',
    put_var_init: 'put_var',
  }

  const normalized = ops
    .map(op => shortMap[op] ?? op)
    .filter(op => !ignore.has(op))

  const filtered: string[] = []
  for (let i = 0; i < normalized.length; i++) {
    const op = normalized[i]
    if (op === 'put_var' && (normalized[i - 1] === 'catch' || normalized[i + 1] === 'catch')) {
      continue
    }
    filtered.push(op)
  }

  if (options.ignoreReturn && filtered.length > 0) {
    const last = filtered[filtered.length - 1]
    if (last === 'return' || last === 'return_undef') {
      return filtered.slice(0, -1)
    }
  }

  return filtered
}

const compileEmitterOpcodes = (source: string): string[] => {
  const atomTable = new AtomTable()
  const node = parseSource(source, { fileName: 'stmt.ts' })
  const compiler = new BytecodeCompiler({ atomTable })
  const buffer = compiler.compile(node)
  return decodeOpcodes(buffer.toUint8Array())
}

const assertStatementAligned = async (source: string, options?: { ignoreReturn?: boolean }) => {
  const ours = normalizeOpcodes(compileEmitterOpcodes(source), options)
  const wasm = normalizeOpcodes(await extractWasmOpcodes(source), options)
  assert.deepEqual(ours, wasm)
}

test('statements: variable declaration aligns with wasm', async () => {
  await assertStatementAligned('let a = 1;', { ignoreReturn: true })
})

test('statements: if statement aligns with wasm', async () => {
  await assertStatementAligned('if (a) b;', { ignoreReturn: true })
})

test('statements: if-else aligns with wasm', async () => {
  await assertStatementAligned('if (a) b; else c;', { ignoreReturn: true })
})

test('statements: throw aligns with wasm', async () => {
  await assertStatementAligned('throw a;')
})

test('statements: debugger aligns with wasm', async () => {
  await assertStatementAligned('debugger;', { ignoreReturn: true })
})

test('statements: function declaration aligns with wasm', async () => {
  await assertStatementAligned('function foo(a, b) { return a + b; }', { ignoreReturn: true })
})

test('statements: function expression aligns with wasm', async () => {
  await assertStatementAligned('const foo = function(a) { return a; };', { ignoreReturn: true })
})

test('statements: arrow function aligns with wasm', async () => {
  await assertStatementAligned('const foo = (a) => a;', { ignoreReturn: true })
})

test('statements: async function aligns with wasm', async () => {
  await assertStatementAligned('async function foo() { return 1; }', { ignoreReturn: true })
})

test('statements: generator function aligns with wasm', async () => {
  await assertStatementAligned('function* foo() { yield 1; }', { ignoreReturn: true })
})

test('statements: with aligns with wasm', async () => {
  await assertStatementAligned('with (obj) { x = 1; }', { ignoreReturn: true })
})

test('statements: while loop aligns with wasm', async () => {
  await assertStatementAligned('while (a) { b; }', { ignoreReturn: true })
})

test('statements: do-while loop aligns with wasm', async () => {
  await assertStatementAligned('do { b; } while (a);', { ignoreReturn: true })
})

test('statements: for loop aligns with wasm', async () => {
  await assertStatementAligned('for (i = 0; i < 1; i = i + 1) { b; }', { ignoreReturn: true })
})

test('statements: break aligns with wasm', async () => {
  await assertStatementAligned('while (a) { b; if (c) break; }', { ignoreReturn: true })
})

test('statements: continue aligns with wasm', async () => {
  await assertStatementAligned('while (a) { b; if (c) continue; d; }', { ignoreReturn: true })
})

test('statements: for-in aligns with wasm', async () => {
  await assertStatementAligned('for (key in obj) { body; }', { ignoreReturn: true })
})

test('statements: for-of aligns with wasm', async () => {
  await assertStatementAligned('for (item of iter) { body; }', { ignoreReturn: true })
})

test('statements: switch aligns with wasm', async () => {
  await assertStatementAligned(`
    switch (x) {
      case 1:
        a;
        break;
      case 2:
        b;
        break;
      default:
        c;
    }
  `, { ignoreReturn: true })
})

test('statements: try-catch aligns with wasm', async () => {
  await assertStatementAligned(`
    try {
      a;
    } catch (e) {
      b;
    }
  `, { ignoreReturn: true })
})

test('statements: try-finally aligns with wasm', async () => {
  await assertStatementAligned(`
    try {
      a;
    } finally {
      b;
    }
  `, { ignoreReturn: true })
})