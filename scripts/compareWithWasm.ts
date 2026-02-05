#!/usr/bin/env tsx
import fs from 'fs/promises'
import path from 'path'
import ts from 'typescript'

import { parseSource } from '../src/ast/parser'
import { BytecodeCompiler } from '../src/emitter/emitter'
import { AtomTable } from '../src/emitter/atom-table'
import { OPCODE_BY_CODE, TEMP_OPCODE_BY_CODE, TempOpcode } from '../src/env'
import { LabelResolver } from '../src/label/label-resolver'
import { resolveVariables } from '../src/label/resolve-variables'
import { peepholeOptimize } from '../src/optimizer/peephole'
import { convertShortOpcodes } from '../src/optimizer/short-opcodes'
import { eliminateDeadCode } from '../src/optimizer/dead-code'
import { QuickJSLib } from './QuickJSLib'

export type CompareResult = {
	file: string
	status: 'pass' | 'fail' | 'skip'
	error?: string
}

const DEFAULT_FIXTURES_DIRS = [
	path.resolve(process.cwd(), 'fixtures/basic'),
	path.resolve(process.cwd(), 'fixtures/es2020'),
	path.resolve(process.cwd(), 'fixtures/quickjs'),
]

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

const OPCODE_BY_ID = (() => {
	const map = new Map<string, { size: number }>()
	for (const def of Object.values(OPCODE_BY_CODE)) {
		map.set(def.id, def)
	}
	for (const def of Object.values(TEMP_OPCODE_BY_CODE)) {
		map.set(def.id, def)
	}
	return map
})()

const getScanDef = (opcode: number) => {
	if (TEMP_SCOPE_OPCODES.has(opcode)) {
		return TEMP_OPCODE_BY_CODE[opcode]
	}
	return OPCODE_BY_CODE[opcode]
}



const decodeOpcodes = (bytes: Uint8Array, preferTempScopes: boolean): string[] => {
	const ops: string[] = []
	let offset = 0
	while (offset < bytes.length) {
		const opcode = bytes[offset]
		const def = preferTempScopes && TEMP_SCOPE_OPCODES.has(opcode)
			? TEMP_OPCODE_BY_CODE[opcode]
			: OPCODE_BY_CODE[opcode]
		if (!def) throw new Error(`Unknown opcode: ${opcode}`)
		ops.push(def.id)
		offset += def.size
	}
	return ops
}

const hasTopLevelAwait = (source: string, sourcePath: string): boolean => {
	const file = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS)
	let found = false
	const visit = (node: ts.Node, inFunction: boolean) => {
		if (found) return
		if (!inFunction && ts.isAwaitExpression(node)) {
			found = true
			return
		}
		const nextInFunction = inFunction || ts.isFunctionLike(node) || ts.isClassLike(node)
		ts.forEachChild(node, child => visit(child, nextInFunction))
	}
	visit(file, false)
	return found
}

const hasImportMeta = (source: string, sourcePath: string): boolean => {
	const file = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS)
	let found = false
	const visit = (node: ts.Node) => {
		if (found) return
		if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword && node.name.text === 'meta') {
			found = true
			return
		}
		ts.forEachChild(node, visit)
	}
	visit(file)
	return found
}

const rewriteImportMetaForScript = (source: string): string => {
	if (!source.includes('import.meta')) return source
	const header = 'const __import_meta__ = { url: undefined };\n'
	return header + source.replace(/\bimport\.meta\b/g, '__import_meta__')
}

const wrapTopLevelAwait = (source: string): string => (
	`;(async () => {\n${source}\n})();\n`
)

const extractWasmOpcodes = async (
	source: string,
	sourcePath: string,
	compileAsModule: boolean,
): Promise<string[]> => {
	const { result: dump } = await QuickJSLib.withCapturedOutput(async () => {
		const bytes = compileAsModule
			? await QuickJSLib.compileSource(source, sourcePath)
			: await QuickJSLib.compileSourceAsScript(source, sourcePath)
		return QuickJSLib.dumpBytesToString(bytes)
	})
	const lines = dump.split('\n')
	const ops: string[] = []
	let inOpcodes = false
	let opcodeBytes = -1

	for (const line of lines) {
		if (!inOpcodes) {
			const headerMatch = line.match(/opcodes \((\d+) bytes\):/)
			if (headerMatch) {
				inOpcodes = true
				opcodeBytes = Number(headerMatch[1])
			}
			continue
		}

		const match = line.match(/^\s*(\d+)\s+([a-z0-9_]+)/i)
		if (match) {
			const offset = Number(match[1])
			const opcode = match[2]
			ops.push(opcode)
			const def = OPCODE_BY_ID.get(opcode)
			if (opcodeBytes > -1 && def && offset + def.size >= opcodeBytes) {
				break
			}
		}
	}

	return ops
}

const transpileForWasm = (source: string, sourcePath: string, compileAsModule: boolean): string => {
	const result = ts.transpileModule(source, {
		fileName: sourcePath,
		compilerOptions: {
			target: ts.ScriptTarget.ES2022,
			module: compileAsModule ? ts.ModuleKind.ESNext : ts.ModuleKind.CommonJS,
		},
	})
	return result.outputText
}

const normalizeOpcodes = (ops: string[]): string[] => {
	const ignore = new Set([
		'line_num',
		'label',
		'check_define_var',
		'check_var',
		'define_var',
		'invalid',
		'define_class_computed',
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
		goto16: 'goto',
		call0: 'call',
		call1: 'call',
		call2: 'call',
		call3: 'call',
		put_var_init: 'put_var',
		put_var_strict: 'put_var',
	}

	const normalized = ops
		.filter(op => !ignore.has(op))
		.map(op => shortMap[op] ?? op)
	const cleaned: string[] = []
	for (let i = 0; i < normalized.length; i += 1) {
		if (normalized[i] === 'push_i32' && normalized[i + 1] === 'drop') {
			i += 1
			continue
		}
		if (
			normalized[i] === 'get_var' &&
			normalized[i - 1] === 'call_method' &&
			normalized[i + 1] === 'push_const' &&
			normalized[i + 2] === 'define_class'
		) {
			continue
		}
		cleaned.push(normalized[i])
	}
	return cleaned
}

const compileEmitterOpcodes = (
	source: string,
	sourcePath: string,
	compileAsModule: boolean): string[] => {
	const atomTable = new AtomTable()
	const node = parseSource(source, {
		fileName: sourcePath,
		languageVersion: ts.ScriptTarget.ES2022,
		setExternalModuleIndicator: compileAsModule ? (file) => {
			file.externalModuleIndicator ??= file
		} : undefined,
	})

	const compiler = new BytecodeCompiler({
		atomTable,
	})

	const state = compiler.compileWithState(node)
	const raw = state.bytecode.toUint8Array()
	const phase2 = resolveVariables(raw, state.labels.getSlots().length)
	const resolved = new LabelResolver().resolve(phase2, state.labels.getSlots())
	const optimized = eliminateDeadCode(convertShortOpcodes(peepholeOptimize(resolved)))
	return decodeOpcodes(optimized, false)
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

export const collectFixtures = async (dir: string): Promise<string[]> => {
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

export const compareFixture = async (filePath: string): Promise<CompareResult> => {
	try {
		const source = await fs.readFile(filePath, 'utf8')
		const hasMeta = hasImportMeta(source, filePath)
		const scriptSource = hasMeta ? rewriteImportMetaForScript(source) : source
		const normalizedSource = hasTopLevelAwait(scriptSource, filePath)
			? wrapTopLevelAwait(scriptSource)
			: scriptSource
		const transpiledSource = transpileForWasm(normalizedSource, filePath, false)
		const ours = normalizeOpcodes(compileEmitterOpcodes(transpiledSource, filePath, false))
		const wasmSource = transpiledSource
		const wasm = normalizeOpcodes(await extractWasmOpcodes(wasmSource, filePath, false))
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

export const compareFixtures = async (
	dirs: string[],
	options: { maxFiles?: number } = {},
): Promise<CompareResult[]> => {
	const results: CompareResult[] = []
	const maxFiles = options.maxFiles ?? (() => {
		const raw = process.env.COMPARE_MAX_FILES
		if (!raw) return undefined
		const parsed = Number(raw)
		return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
	})()

	for (const dir of dirs) {
		const fixtures = await collectFixtures(dir)
		const slice = maxFiles ? fixtures.slice(0, maxFiles) : fixtures
		for (const file of slice) {
			const result = await compareFixture(file)
			results.push(result)
			const status = result.status === 'pass'
				? '✅'
				: result.status === 'skip'
					? '⏭️'
					: '❌'
			const rel = path.relative(process.cwd(), file)
			const msg = result.error ? ` (${result.error})` : ''
			console.log(`${status} ${rel}${msg}`)
		}
	}

	const passed = results.filter(r => r.status === 'pass').length
	const failed = results.filter(r => r.status === 'fail').length
	const skipped = results.filter(r => r.status === 'skip').length
	console.log(`\nSummary: ${passed} passed, ${failed} failed, ${skipped} skipped (total ${results.length})`)
	console.log(`Overall: ${failed > 0 ? 'FAIL' : 'PASS'}`)
	if (failed > 0) {
		console.log('\nFailed fixtures:')
		for (const result of results) {
			if (result.status !== 'fail') continue
			const rel = path.relative(process.cwd(), result.file)
			const msg = result.error ? ` (${result.error})` : ''
			console.log(`- ${rel}${msg}`)
		}
	}

	if (failed > 0) {
		process.exitCode = 1
	}

	return results
}

const main = async () => {
	console.log(`Comparing fixtures in ${DEFAULT_FIXTURES_DIRS.join(', ')}`)
	await compareFixtures(DEFAULT_FIXTURES_DIRS)
}

if (require.main === module) {
	main().catch((error) => {
		console.error(String(error))
		process.exit(1)
	})
}

