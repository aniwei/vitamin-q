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
  const bytes = await QuickJSLib.compileSourceAsScript(source, 'destructuring.js')
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
    for_of_next: 'for_of_next',
  }

  const normalized = ops
    .map(op => shortMap[op] ?? op)
    .filter(op => !ignore.has(op))

  if (options.ignoreReturn && normalized.length > 0) {
    const last = normalized[normalized.length - 1]
    if (last === 'return' || last === 'return_undef') {
      return normalized.slice(0, -1)
    }
  }

  return normalized
}

const compileEmitterOpcodes = (source: string): string[] => {
  const atomTable = new AtomTable()
  const node = parseSource(source, { fileName: 'destructuring.ts' })
  const compiler = new BytecodeCompiler({ atomTable })
  const buffer = compiler.compile(node)
  return decodeOpcodes(buffer.toUint8Array())
}

const assertDestructuringAligned = async (source: string, options?: { ignoreReturn?: boolean }) => {
  const ours = normalizeOpcodes(compileEmitterOpcodes(source), options)
  const wasm = normalizeOpcodes(await extractWasmOpcodes(source), options)
  assert.deepEqual(ours, wasm)
}

test('destructuring: object var aligns with wasm', async () => {
  await assertDestructuringAligned('let { a } = obj;', { ignoreReturn: true })
})

test('destructuring: object assignment aligns with wasm', async () => {
  await assertDestructuringAligned('({ a } = obj);', { ignoreReturn: true })
})

test('destructuring: array var aligns with wasm', async () => {
  await assertDestructuringAligned('let [a, b] = arr;', { ignoreReturn: true })
})

test('destructuring: array assignment aligns with wasm', async () => {
  await assertDestructuringAligned('([a, b] = arr);', { ignoreReturn: true })
})
