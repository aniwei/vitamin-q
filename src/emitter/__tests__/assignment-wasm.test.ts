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
  const bytes = await QuickJSLib.compileSourceAsScript(source, 'assign.js')
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
    'set_loc0',
    'set_loc1',
    'set_loc2',
    'set_loc3',
    'set_loc',
    'return',
    'return_undef',
    'label',
    'goto',
    'goto8',
    'if_true',
    'if_true8',
    'if_false',
    'if_false8',
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
  }

  return ops
    .filter(op => !ignore.has(op))
    .map(op => shortMap[op] ?? op)
}

const compileEmitterOpcodes = (source: string): string[] => {
  const atomTable = new AtomTable()
  const node = parseSource(source, { fileName: 'assign.ts' })
  const compiler = new BytecodeCompiler({ atomTable })
  const buffer = compiler.compile(node)
  return decodeOpcodes(buffer.toUint8Array())
}

const assertAssignmentAligned = async (source: string) => {
  const ours = normalizeOpcodes(compileEmitterOpcodes(source))
  const wasm = normalizeOpcodes(await extractWasmOpcodes(source))
  assert.deepEqual(ours, wasm)
}

test('assignment: simple assignment aligns with wasm', async () => {
  await assertAssignmentAligned('a = 1;')
})

test('assignment: compound assignment aligns with wasm', async () => {
  await assertAssignmentAligned('a += 1;')
})

test('assignment: property assignment aligns with wasm', async () => {
  await assertAssignmentAligned('obj.value = 1;')
})

test('assignment: logical assignment aligns with wasm', async () => {
  await assertAssignmentAligned('obj.value ||= 1;')
})

test('assignment: element assignment aligns with wasm', async () => {
  await assertAssignmentAligned('arr[idx] ??= 1;')
})