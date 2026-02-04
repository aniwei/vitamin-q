import ts from 'typescript'
import fs from 'fs/promises'

import { parseSource } from '../src/ast/parser'
import { BytecodeCompiler } from '../src/emitter/emitter'
import { AtomTable } from '../src/emitter/atom-table'
import { LabelResolver } from '../src/label/label-resolver'
import { resolveVariables } from '../src/label/resolve-variables'
import { peepholeOptimize } from '../src/optimizer/peephole'
import { convertShortOpcodes } from '../src/optimizer/short-opcodes'
import { eliminateDeadCode } from '../src/optimizer/dead-code'
import { OPCODE_BY_CODE, TEMP_OPCODE_BY_CODE, TempOpcode } from '../src/env'
import { QuickJSLib } from './QuickJSLib'

const file = 'fixtures/es2020/misc/symbol-usage.ts'

const transpileForWasm = (source: string, sourcePath: string, compileAsModule: boolean) => (
  ts.transpileModule(source, {
    fileName: sourcePath,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: compileAsModule ? ts.ModuleKind.ESNext : ts.ModuleKind.CommonJS,
    },
  }).outputText
)

const extractWasmOpcodes = async (
  source: string,
  sourcePath: string,
  compileAsModule: boolean,
): Promise<string[]> => {
  const bytes = compileAsModule
    ? await QuickJSLib.compileSource(source, sourcePath)
    : await QuickJSLib.compileSourceAsScript(source, sourcePath)
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
    'check_define_var',
    'define_var',
    'set_loc',
    'set_loc0',
    'set_loc1',
    'set_loc2',
    'set_loc3',
    'set_loc8',
    'get_loc0',
    'put_loc0',
    'set_loc_uninitialized',
    'enter_scope',
    'leave_scope',
    'undefined',
    'return',
    'return_undef',
    'return_async',
  ])
  const shortMap: Record<string, string> = {
    push_0: 'push_i32',
    push_1: 'push_i32',
    push_2: 'push_i32',
    push_3: 'push_i32',
    push_4: 'push_i32',
    push_5: 'push_i32',
    push_6: 'push_i32',
    push_7: 'push_i32',
    push_i8: 'push_i32',
    push_i16: 'push_i32',
    push_const8: 'push_const',
    get_loc0: 'get_var',
    get_loc1: 'get_var',
    get_loc2: 'get_var',
    get_loc3: 'get_var',
    get_loc8: 'get_var',
    get_loc: 'get_var',
    get_loc_check: 'get_var',
    get_length: 'get_field',
    get_arg0: 'get_arg',
    get_arg1: 'get_arg',
    get_arg2: 'get_arg',
    get_arg3: 'get_arg',
    put_loc0: 'put_var',
    put_loc1: 'put_var',
    put_loc2: 'put_var',
    put_loc3: 'put_var',
    put_loc8: 'put_var',
    put_loc: 'put_var',
    put_loc_check: 'put_var',
    put_arg0: 'put_arg',
    put_arg1: 'put_arg',
    put_arg2: 'put_arg',
    put_arg3: 'put_arg',
  }
  return ops.filter(op => !ignore.has(op)).map(op => shortMap[op] ?? op)
}

const TEMP_SCOPE_OPCODES = new Set<number>([
  TempOpcode.OP_scope_get_var_undef,
  TempOpcode.OP_scope_get_var,
  TempOpcode.OP_scope_put_var,
  TempOpcode.OP_scope_delete_var,
  TempOpcode.OP_scope_make_ref,
  TempOpcode.OP_scope_get_ref,
  TempOpcode.OP_scope_put_var_init,
  TempOpcode.OP_scope_get_var_checkthis,
  TempOpcode.OP_scope_get_private_field,
  TempOpcode.OP_scope_get_private_field2,
  TempOpcode.OP_scope_put_private_field,
  TempOpcode.OP_scope_in_private_field,
])


const decodeOpcodes = (bytes: Uint8Array) => {
  const ops: { id: string; opcode: number; offset: number; size: number }[] = []
  let offset = 0
  while (offset < bytes.length) {
    const opcode = bytes[offset]
    const def = OPCODE_BY_CODE[opcode]
      ?? (TEMP_SCOPE_OPCODES.has(opcode) ? TEMP_OPCODE_BY_CODE[opcode] : undefined)
    if (!def) throw new Error(`Unknown opcode: ${opcode}`)
    ops.push({ id: def.id, opcode, offset, size: def.size })
    offset += def.size
  }
  return ops
}

const run = async () => {
  const source = await fs.readFile(file, 'utf8')
  const transpiledSource = transpileForWasm(source, file, false)
  const sourceFile = parseSource(transpiledSource, { fileName: file })
  const atomTable = new AtomTable()
  const compiler = new BytecodeCompiler({ atomTable })
  const state = compiler.compileWithState(sourceFile)
  const raw = state.bytecode.toUint8Array()
  const phase2 = resolveVariables(raw, state.labels.getSlots().length)
  const resolved = new LabelResolver().resolve(phase2, state.labels.getSlots())
  const optimized = eliminateDeadCode(convertShortOpcodes(peepholeOptimize(resolved)))

  const rawOps = decodeOpcodes(optimized)
  const ours = normalizeOpcodes(rawOps.map(op => op.id))
  const wasm = normalizeOpcodes(await extractWasmOpcodes(transpiledSource, file, false))

  let diff = -1
  for (let i = 0; i < Math.max(ours.length, wasm.length); i += 1) {
    if (ours[i] !== wasm[i]) {
      diff = i
      break
    }
  }

  console.log('diff', diff, 'ours', ours[diff], 'wasm', wasm[diff])
  console.log('ours slice', ours.slice(diff - 5, diff + 10))
  console.log('wasm slice', wasm.slice(diff - 5, diff + 10))
  console.log('normalized indexed slice')
  for (let i = Math.max(0, diff - 5); i < diff + 10; i += 1) {
    console.log(i, ours[i], wasm[i])
  }

  const classComputedIndex = rawOps.findIndex(op => op.id === 'define_class_computed')
  if (classComputedIndex >= 0) {
    console.log('raw define_class_computed at', classComputedIndex)
    console.log('raw slice', rawOps.slice(classComputedIndex - 5, classComputedIndex + 10).map(op => op.id))
  }

  const start = Math.max(0, classComputedIndex - 10)
  const end = classComputedIndex + 15
  if (classComputedIndex >= 0) {
    console.log('raw indexed slice')
    for (let i = start; i < end; i += 1) {
      console.log(i, rawOps[i]?.id, rawOps[i]?.opcode, rawOps[i]?.offset)
    }
  }

  const classIndices = rawOps
    .map((op, index) => ({ op: op.id, index }))
    .filter(entry => entry.op === 'define_class' || entry.op === 'define_class_computed')
  console.log('raw class op indices', classIndices)

  const targetClassIndex = classIndices.find(entry => entry.op === 'define_class' && entry.index === 184)
  if (targetClassIndex) {
    console.log('raw slice around define_class@184')
    for (let i = targetClassIndex.index - 12; i < targetClassIndex.index + 12; i += 1) {
      if (i < 0 || i >= rawOps.length) continue
      const entry = rawOps[i]
      console.log(i, entry.id, entry.opcode, entry.offset)
    }
    const bytes = optimized
    const startOffset = Math.max(0, (rawOps[targetClassIndex.index - 8]?.offset ?? 0) - 4)
    const endOffset = (rawOps[targetClassIndex.index + 8]?.offset ?? startOffset) + 16
    console.log('raw bytes around define_class offsets', startOffset, endOffset)
    const slice = Array.from(bytes.slice(startOffset, endOffset))
    console.log(slice.map(b => b.toString(16).padStart(2, '0')).join(' '))
  }
}

run()
