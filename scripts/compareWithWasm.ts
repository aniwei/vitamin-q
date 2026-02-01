#!/usr/bin/env tsx
import fs from 'fs/promises'
import path from 'path'
import ts from 'typescript'

import { parseSource } from '../src/ast/parser'
import { BytecodeCompiler } from '../src/emitter/emitter'
import { AtomTable } from '../src/emitter/atom-table'
import { OPCODE_BY_CODE, TEMP_OPCODE_BY_CODE } from '../src/env'
import { QuickJSLib } from './QuickJSLib'

type CompareResult = {
	file: string
	status: 'pass' | 'fail'
	error?: string
}

const FIXTURES_DIR = path.resolve(process.cwd(), 'fixtures/basic')

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

const extractWasmOpcodes = async (source: string, sourcePath: string): Promise<string[]> => {
	const bytes = await QuickJSLib.compileSourceAsScript(source, sourcePath)
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

const transpileForWasm = (source: string, sourcePath: string): string => {
	const result = ts.transpileModule(source, {
		fileName: sourcePath,
		compilerOptions: {
			target: ts.ScriptTarget.ES2022,
			module: ts.ModuleKind.CommonJS,
		},
	})
	return result.outputText
}

const normalizeOpcodes = (ops: string[]): string[] => {
	const ignore = new Set([
		'line_num',
		'label',
		'check_define_var',
		'define_var',
		'set_loc0',
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
		set_loc1: 'set_loc',
		set_loc2: 'set_loc',
		set_loc3: 'set_loc',
		set_loc8: 'set_loc',
		set_arg0: 'put_arg',
		set_arg1: 'put_arg',
		set_arg2: 'put_arg',
		set_arg3: 'put_arg',
		fclosure8: 'fclosure',
		if_true8: 'if_true',
		if_false8: 'if_false',
		goto8: 'goto',
		call0: 'call',
		call1: 'call',
		call2: 'call',
		call3: 'call',
		put_var_init: 'put_var',
	}

	return ops
		.filter(op => !ignore.has(op))
		.map(op => shortMap[op] ?? op)
}

const compileEmitterOpcodes = (
	source: string, 
	sourcePath: string): string[] => {
	const atomTable = new AtomTable()
	const node = parseSource(source, { 
		fileName: sourcePath 
	})

	const compiler = new BytecodeCompiler({ 	
		atomTable 
	})

	const buffer = compiler.compile(node)
	return decodeOpcodes(buffer.toUint8Array())
}

const compareOps = (
	ours: string[], 
	wasm: string[]): string | undefined => {
	const length = Math.max(ours.length, wasm.length)
	for (let i = 0; i < length; i += 1) {
		if (ours[i] !== wasm[i]) {
			return `first diff at ${i}: ours=${ours[i] ?? '<none>'}, wasm=${wasm[i] ?? '<none>'}`
		}
	}
	return undefined
}

const debugDiffSlice = (ours: string[], wasm: string[], filePath: string) => {
	const rel = path.relative(process.cwd(), filePath)
	const target = process.env.COMPARE_DEBUG_FILE
	if (!target || rel !== target) return
	const length = Math.max(ours.length, wasm.length)
	let diff = -1
	for (let i = 0; i < length; i += 1) {
		if (ours[i] !== wasm[i]) {
			diff = i
			break
		}
	}
	const start = Math.max(0, diff - 6)
	const end = diff + 6
	console.log(`debug ${rel} diff=${diff} ours=${ours[diff]} wasm=${wasm[diff]}`)
	console.log('ours slice', ours.slice(start, end))
	console.log('wasm slice', wasm.slice(start, end))
}

const collectFixtures = async (dir: string): Promise<string[]> => {
	const entries = await fs.readdir(dir, { withFileTypes: true })
	const files: string[] = []
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name)
		if (entry.isDirectory()) {
			files.push(...await collectFixtures(fullPath))
		} else if (entry.isFile() && entry.name.endsWith('.ts')) {
			files.push(fullPath)
		}
	}
	return files
}

const compareFixture = async (filePath: string): Promise<CompareResult> => {
	try {
		const source = await fs.readFile(filePath, 'utf8')
		const ours = normalizeOpcodes(compileEmitterOpcodes(source, filePath))
		const wasmSource = transpileForWasm(source, filePath)
		const wasm = normalizeOpcodes(await extractWasmOpcodes(wasmSource, filePath))
		debugDiffSlice(ours, wasm, filePath)
		const diff = compareOps(ours, wasm)
		if (diff) {
			return { file: filePath, status: 'fail', error: diff }
		}
		return { file: filePath, status: 'pass' }
	} catch (error) {
		return { file: filePath, status: 'fail', error: String(error) }
	}
}

const main = async () => {
	console.log(`Comparing fixtures in ${FIXTURES_DIR}`)
	const fixtures = await collectFixtures(FIXTURES_DIR)
	const results: CompareResult[] = []

	for (const file of fixtures) {
		const result = await compareFixture(file)
		results.push(result)
		const status = result.status === 'pass' ? '✅' : '❌'
		const rel = path.relative(process.cwd(), file)
		const msg = result.error ? ` (${result.error})` : ''
		console.log(`${status} ${rel}${msg}`)
	}

	const passed = results.filter(r => r.status === 'pass').length
	const failed = results.filter(r => r.status === 'fail').length
	console.log(`\nSummary: ${passed} passed, ${failed} failed (total ${results.length})`)

	if (failed > 0) {
		process.exitCode = 1
	}
}

main().catch((error) => {
	console.error(String(error))
	process.exit(1)
})

