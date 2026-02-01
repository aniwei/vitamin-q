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
  const bytes = await QuickJSLib.compileSourceAsScript(source, 'expr.js')
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

const normalizeOpcodes = (ops: string[]): string[] => {
  const ignore = new Set([
    'line_num',
    'label',
    'undefined',
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
    'return',
    'return_undef',
  ])

  const shortMap: Record<string, string> = {
    push_0: 'push_i32',
    push_1: 'push_i32',
    push_2: 'push_i32',
    push_3: 'push_i32',
    push_i8: 'push_i32',
    push_const8: 'push_const',
    fclosure8: 'fclosure',
    if_true8: 'if_true',
    if_false8: 'if_false',
    goto8: 'goto',
    call2: 'call',
    get_arg0: 'get_arg',
    get_arg1: 'get_arg',
    get_arg2: 'get_arg',
    get_arg3: 'get_arg',
  }

  return ops
    .map(op => shortMap[op] ?? op)
    .filter(op => !ignore.has(op))
}

const compileEmitterOpcodes = (source: string): string[] => {
  const atomTable = new AtomTable()
  const node = parseSource(source, { fileName: 'expr.ts' })
  const compiler = new BytecodeCompiler({ atomTable })
  const buffer = compiler.compile(node)
  return decodeOpcodes(buffer.toUint8Array())
}

const assertExpressionAligned = async (source: string) => {
  const ours = normalizeOpcodes(compileEmitterOpcodes(source))
  const wasm = normalizeOpcodes(await extractWasmOpcodes(source))
  assert.deepEqual(ours, wasm)
}

test('expressions: numeric literal aligns with wasm', async () => {
  await assertExpressionAligned('1;')
})

test('expressions: binary add aligns with wasm', async () => {
  await assertExpressionAligned('1 + 2;')
})

test('expressions: identifier aligns with wasm', async () => {
  await assertExpressionAligned('foo;')
})

test('expressions: property access aligns with wasm', async () => {
  await assertExpressionAligned('obj.value;')
})

test('expressions: call expression aligns with wasm', async () => {
  await assertExpressionAligned('fn(1, 2);')
})

test('expressions: regexp literal aligns with wasm', async () => {
  await assertExpressionAligned('/ab+/gi;')
})

test('expressions: conditional expression aligns with wasm', async () => {
  await assertExpressionAligned('cond ? a : b;')
})

test('expressions: logical and aligns with wasm', async () => {
  await assertExpressionAligned('a && b;')
})

test('expressions: logical or aligns with wasm', async () => {
  await assertExpressionAligned('a || b;')
})

test('expressions: nullish coalescing aligns with wasm', async () => {
  await assertExpressionAligned('a ?? b;')
})

test('expressions: element access aligns with wasm', async () => {
  await assertExpressionAligned('obj["x"];')
})

test('expressions: unary typeof aligns with wasm', async () => {
  await assertExpressionAligned('typeof value;')
})