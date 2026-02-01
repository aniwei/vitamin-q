import assert from 'node:assert/strict'
import test from 'node:test'

import { QuickJSLib } from '../../../scripts/QuickJSLib'
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

	const shortMap: Record<string, string> = {
		get_arg0: 'get_arg',
		get_arg1: 'get_arg',
		get_arg2: 'get_arg',
		get_arg3: 'get_arg',
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
	}

	return ops
		.map(op => shortMap[op] ?? op)
		.filter(op => !ignore.has(op))
}

const extractWasmFunctionOpcodes = async (source: string, functionName: string): Promise<string[]> => {
	const bytes = await QuickJSLib.compileSourceAsScript(source, 'fn.js')
	const logs: string[] = []
	const prevLog = console.log
	const prevErr = console.error
	const prevStdoutWrite = process.stdout.write.bind(process.stdout)
	const prevStderrWrite = process.stderr.write.bind(process.stderr)
	console.log = (...args: unknown[]) => {
		logs.push(args.map(arg => String(arg)).join(' '))
	}
	console.error = (...args: unknown[]) => {
		logs.push(args.map(arg => String(arg)).join(' '))
	}
	process.stdout.write = ((chunk: unknown, ...args: unknown[]) => {
		logs.push(String(chunk))
		return prevStdoutWrite(chunk as any, ...args as any)
	}) as typeof process.stdout.write
	process.stderr.write = ((chunk: unknown, ...args: unknown[]) => {
		logs.push(String(chunk))
		return prevStderrWrite(chunk as any, ...args as any)
	}) as typeof process.stderr.write
	let dump = ''
	try {
		dump = await QuickJSLib.dumpBytesToString(bytes)
	} finally {
		console.log = prevLog
		console.error = prevErr
		process.stdout.write = prevStdoutWrite
		process.stderr.write = prevStderrWrite
	}
	const lines = [...logs, dump].join('\n').split('\n')

	let inFunction = false
	const ops: string[] = []
	const skip = new Set(['function', 'locals', 'args', 'stack_size', 'opcodes'])

	for (const line of lines) {
		if (!inFunction) {
			if (line.includes(`function: ${functionName}`)) {
				inFunction = true
			}
			continue
		}

		if (line.includes('function: ') && ops.length > 0) break

		const match = line.match(/^\s*(?:\d+:\s*)?([a-z0-9_]+)/i)
		if (match) {
			const op = match[1]
			if (!skip.has(op)) {
				ops.push(op)
			}
		}
	}

	if (!inFunction) {
		throw new Error(`未找到函数: ${functionName}`)
	}

	return ops
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

test.skip('functions: body aligns with wasm (simple return)', async () => {
	const source = 'function foo(a, b) { return a + b; }'
	const ours = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
	const wasm = normalizeOpcodes(await extractWasmFunctionOpcodes(source, 'foo'))
	assert.deepEqual(ours, wasm)
})

test.skip('functions: body aligns with wasm (rest parameter)', async () => {
	const source = 'function foo(...args) { return args; }'
	const ours = normalizeOpcodes(extractTemplateOpcodes(source, 'foo'))
	const wasm = normalizeOpcodes(await extractWasmFunctionOpcodes(source, 'foo'))
	assert.deepEqual(ours, wasm)
})

