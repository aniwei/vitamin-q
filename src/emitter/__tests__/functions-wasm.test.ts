import assert from 'node:assert/strict'
import test from 'node:test'

import { QuickJSLib } from '../../../scripts/QuickJSLib'
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
		push_0: 'push_i32',
		push_1: 'push_i32',
		push_2: 'push_i32',
		push_3: 'push_i32',
		get_loc0: 'get_loc',
		get_loc1: 'get_loc',
		get_loc2: 'get_loc',
		get_loc3: 'get_loc',
		get_arg0: 'get_arg',
		get_arg1: 'get_arg',
		get_arg2: 'get_arg',
		get_arg3: 'get_arg',
		put_loc0: 'put_loc',
		put_loc1: 'put_loc',
		put_loc2: 'put_loc',
		put_loc3: 'put_loc',
		put_arg0: 'put_arg',
		put_arg1: 'put_arg',
		put_arg2: 'put_arg',
		put_arg3: 'put_arg',
		set_arg0: 'put_arg',
		set_arg1: 'put_arg',
		set_arg2: 'put_arg',
		set_arg3: 'put_arg',
		fclosure8: 'fclosure',
		if_false8: 'if_false',
		if_true8: 'if_true',
		goto8: 'goto',
		scope_get_var_undef: 'push_2',
	}

	return ops
		.map(op => shortMap[op] ?? op)
		.filter(op => !ignore.has(op))
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const extractWasmFunctionOpcodes = async (source: string, functionName: string): Promise<string[]> => {
	const { stdout } = await QuickJSLib.withCapturedOutput(() =>
		QuickJSLib.compileSourceAsScript(source, 'fn.js'),
	)
	const lines = stdout.join('\n').split('\n')

	const functions: Array<{ name: string; ops: string[] }> = []
	const skip = new Set(['function', 'locals', 'args', 'stack_size', 'opcodes'])
	const namePattern = new RegExp(`^<?${escapeRegExp(functionName)}>?$`)
	let current: { name: string; ops: string[] } | null = null
	let inOpcodes = false

	for (const line of lines) {
		const fnIndex = line.indexOf('function:')
		if (fnIndex >= 0) {
			if (current) functions.push(current)
			const name = line.slice(fnIndex + 'function:'.length).trim()
			current = { name, ops: [] }
			inOpcodes = false
			continue
		}

		if (!current) continue

		if (line.includes('opcodes:')) {
			inOpcodes = true
			continue
		}

		if (!inOpcodes) continue

		const match = line.match(/^\s*(?:\d+:\s*)?([a-z0-9_]+)/i)
		if (match) {
			const op = match[1]
			if (!skip.has(op)) {
				current.ops.push(op)
			}
		}
	}

	if (current) functions.push(current)

	const exact = functions.find((fn) => namePattern.test(fn.name))
	if (exact) return exact.ops

	const fallback = functions.find((fn) => fn.name !== '<eval>')
	if (fallback) return fallback.ops

	throw new Error(`未找到函数: ${functionName}`)
}

const extractWasmSpecialObjectOperands = async (source: string, functionName: string): Promise<number[]> => {
	const { stdout } = await QuickJSLib.withCapturedOutput(() =>
		QuickJSLib.compileSourceAsScript(source, 'fn.js'),
	)
	const lines = stdout.join('\n').split('\n')

	const namePattern = new RegExp(`^<?${escapeRegExp(functionName)}>?$`)
	let inTarget = false
	let inOpcodes = false
	const operands: number[] = []

	for (const line of lines) {
		const fnIndex = line.indexOf('function:')
		if (fnIndex >= 0) {
			const name = line.slice(fnIndex + 'function:'.length).trim()
			inTarget = namePattern.test(name)
			inOpcodes = false
			continue
		}

		if (!inTarget) continue
		if (line.includes('opcodes:')) {
			inOpcodes = true
			continue
		}
		if (!inOpcodes) continue

		const match = line.match(/^\s*(?:\d+:\s*)?special_object\s+(\d+)/i)
		if (match) operands.push(Number(match[1]))
	}

	if (operands.length === 0) {
		throw new Error(`未找到函数 special_object: ${functionName}`)
	}

	return operands
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

test('functions: body aligns with wasm (simple return)', async () => {
	const source = 'function foo(a, b) { return a + b; }'
	const ours = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
	const wasm = normalizeOpcodes(await extractWasmFunctionOpcodes(source, 'foo'))
	assert.deepEqual(ours, wasm)
})

test('functions: body aligns with wasm (rest parameter)', async () => {
	const source = 'function foo(...args) { return args; }'
	const ours = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
	const wasm = normalizeOpcodes(await extractWasmFunctionOpcodes(source, 'foo'))
	assert.deepEqual(ours, wasm)
})

test('functions: body aligns with wasm (for await...of)', async () => {
	const source = 'async function foo(iter) { for await (const item of iter) { } }'
	const ours = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
	const wasm = normalizeOpcodes(await extractWasmFunctionOpcodes(source, 'foo'))
	assert.deepEqual(ours, wasm)
})

test('functions: body aligns with wasm (await expression)', async () => {
	const source = 'async function foo(p) { const x = await p; return x; }'
	const ours = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
	const wasm = normalizeOpcodes(await extractWasmFunctionOpcodes(source, 'foo'))
	assert.deepEqual(ours, wasm)
})

test('functions: body aligns with wasm (async yield*)', async () => {
	const source = 'async function* foo(iter) { yield* iter; }'
	const ours = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
	const wasm = normalizeOpcodes(await extractWasmFunctionOpcodes(source, 'foo'))
	assert.deepEqual(ours, wasm)
})

test('functions: body aligns with wasm (generator yield)', async () => {
	const source = 'function* foo() { yield 1; }'
	const ours = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
	const wasm = normalizeOpcodes(await extractWasmFunctionOpcodes(source, 'foo'))
	assert.deepEqual(ours, wasm)
})

test('functions: body aligns with wasm (generator yield*)', async () => {
	const source = 'function* foo(iter) { yield* iter; }'
	const ours = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
	const wasm = normalizeOpcodes(await extractWasmFunctionOpcodes(source, 'foo'))
	assert.deepEqual(ours, wasm)
})

test('functions: body aligns with wasm (generator return)', async () => {
	const source = 'function* foo() { return 1; }'
	const ours = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
	const wasm = normalizeOpcodes(await extractWasmFunctionOpcodes(source, 'foo'))
	assert.deepEqual(ours, wasm)
})

test('functions: body aligns with wasm (generator empty)', async () => {
	const source = 'function* foo() { }'
	const ours = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
	const wasm = normalizeOpcodes(await extractWasmFunctionOpcodes(source, 'foo'))
	assert.deepEqual(ours, wasm)
})

test('functions: body aligns with wasm (generator yield assignment)', async () => {
	const source = 'function* foo() { const x = yield 1; return x; }'
	const ours = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
	const wasm = normalizeOpcodes(await extractWasmFunctionOpcodes(source, 'foo'))
	assert.deepEqual(ours, wasm)
})

test('functions: body aligns with wasm (async generator yield)', async () => {
	const source = 'async function* foo() { yield 1; }'
	const ours = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
	const wasm = normalizeOpcodes(await extractWasmFunctionOpcodes(source, 'foo'))
	assert.deepEqual(ours, wasm)
})

test('functions: body aligns with wasm (async generator yield assignment)', async () => {
	const source = 'async function* foo() { const x = yield 1; return x; }'
	const ours = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
	const wasm = normalizeOpcodes(await extractWasmFunctionOpcodes(source, 'foo'))
	assert.deepEqual(ours, wasm)
})

test('functions: body aligns with wasm (async generator return)', async () => {
	const source = 'async function* foo() { return 1; }'
	const ours = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
	const wasm = normalizeOpcodes(await extractWasmFunctionOpcodes(source, 'foo'))
	assert.deepEqual(ours, wasm)
})

test('functions: body aligns with wasm (async generator empty)', async () => {
	const source = 'async function* foo() { }'
	const ours = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
	const wasm = normalizeOpcodes(await extractWasmFunctionOpcodes(source, 'foo'))
	assert.deepEqual(ours, wasm)
})

test('functions: body aligns with wasm (async generator for await...of)', async () => {
	const source = 'async function* foo(iter) { for await (const x of iter) { } }'
	const ours = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
	const wasm = normalizeOpcodes(await extractWasmFunctionOpcodes(source, 'foo'))
	assert.deepEqual(ours, wasm)
})

test('functions: body aligns with wasm (async generator for await...of yield)', async () => {
	const source = 'async function* foo(iter) { for await (const x of iter) { yield x; } }'
	const ours = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
	const wasm = normalizeOpcodes(await extractWasmFunctionOpcodes(source, 'foo'))
	assert.deepEqual(ours, wasm)
})

test('functions: body aligns with wasm (this binding)', async () => {
	const source = 'function foo() { return this; }'
	const ours = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
	const wasm = normalizeOpcodes(await extractWasmFunctionOpcodes(source, 'foo'))
	assert.deepEqual(ours, wasm)
})

test('functions: body aligns with wasm (arguments binding)', async () => {
	const source = 'function foo(a) { return arguments; }'
	const ours = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
	const wasm = normalizeOpcodes(await extractWasmFunctionOpcodes(source, 'foo'))
	assert.deepEqual(ours, wasm)
})

test('functions: body aligns with wasm (new.target binding)', async () => {
	const source = 'function foo() { return new.target; }'
	const ours = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
	const wasm = normalizeOpcodes(await extractWasmFunctionOpcodes(source, 'foo'))
	assert.deepEqual(ours, wasm)
})

test('functions: arguments mapped aligns with wasm', async () => {
	const source = 'function foo(a) { return arguments; }'
	const ours = extractSpecialObjectOperands(extractTemplateBytecode(source, 'foo'))
	const wasm = await extractWasmSpecialObjectOperands(source, 'foo')
	assert.deepEqual(ours, wasm)
	assert.equal(ours[0], OPSpecialObjectEnum.OP_SPECIAL_OBJECT_MAPPED_ARGUMENTS)
})

test('functions: arguments strict aligns with wasm', async () => {
	const source = "function foo(a) { 'use strict'; return arguments; }"
	const ours = extractSpecialObjectOperands(extractTemplateBytecode(source, 'foo'))
	const wasm = await extractWasmSpecialObjectOperands(source, 'foo')
	assert.deepEqual(ours, wasm)
	assert.equal(ours[0], OPSpecialObjectEnum.OP_SPECIAL_OBJECT_ARGUMENTS)
})

test('functions: arguments non-simple aligns with wasm', async () => {
	const source = 'function foo(a = 1) { return arguments; }'
	const ours = extractSpecialObjectOperands(extractTemplateBytecode(source, 'foo'))
	const wasm = await extractWasmSpecialObjectOperands(source, 'foo')
	assert.deepEqual(ours, wasm)
	assert.equal(ours[0], OPSpecialObjectEnum.OP_SPECIAL_OBJECT_ARGUMENTS)
})

