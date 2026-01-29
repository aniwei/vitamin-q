import assert from 'node:assert/strict'
import test from 'node:test'

import * as env from '../../env'
import { QuickJSLib } from '../../../scripts/QuickJSLib'

type EnumMap = Record<string, number>

const getEnumMap = (enumObj: Record<string, number | string>): EnumMap => {
  const entries = Object.entries(enumObj)
    .filter(([key, value]) => typeof value === 'number' && Number.isNaN(Number(key)))
    .map(([key, value]) => [key, value as number])
  return Object.fromEntries(entries)
}

const assertEnumEqual = (name: string, actual: EnumMap, expected: EnumMap) => {
  const actualKeys = Object.keys(actual).sort()
  const expectedKeys = Object.keys(expected).sort()
  assert.deepEqual(actualKeys, expectedKeys, `${name}: 枚举键不一致`)
  for (const key of actualKeys) {
    assert.equal(actual[key], expected[key], `${name}.${key} 值不一致`)
  }
}

test('env: CompileFlags 对齐', async () => {
  const wasm = await QuickJSLib.getCompileEnums()
  assertEnumEqual('CompileFlags', getEnumMap(env.CompileFlags), wasm)
})

test('env: PutLValueEnum 对齐', async () => {
  const wasm = await QuickJSLib.getPutLValueEnum()
  assertEnumEqual('PutLValueEnum', getEnumMap(env.PutLValueEnum), wasm)
})

test('env: BytecodeTag/FunctionKind/JSMode/PC2Line/SpecialObjects/OpFormat 对齐', async () => {
  const [bytecodeTags, functionKinds, jsModes, pc2LineCodes, specialObjects, opFormats, parseFunctionEnums, parseExportEnums, varKindEnums] = await Promise.all([
    QuickJSLib.getAllBytecodeTags(),
    QuickJSLib.getFunctionKinds(),
    QuickJSLib.getJSModes(),
    QuickJSLib.getPC2LineCodes(),
    QuickJSLib.getSpecialObjects(),
    QuickJSLib.getAllOpcodeFormats(),
    QuickJSLib.getParseFunctionEnums(),
    QuickJSLib.getParseExportEnums(),
    QuickJSLib.getVarKindEnums(),
  ])

  assertEnumEqual('BytecodeTag', getEnumMap(env.BytecodeTag), bytecodeTags)
  assertEnumEqual('FunctionKind', getEnumMap(env.FunctionKind), functionKinds)
  assertEnumEqual('JSMode', getEnumMap(env.JSMode), jsModes)
  assertEnumEqual('PC2Line', getEnumMap(env.PC2Line), pc2LineCodes)
  assertEnumEqual('OPSpecialObjectEnum', getEnumMap(env.OPSpecialObjectEnum), specialObjects)
  assertEnumEqual('OpFormat', getEnumMap(env.OpFormat), opFormats)
  assertEnumEqual('JSParseFunctionEnum', getEnumMap(env.JSParseFunctionEnum), parseFunctionEnums)
  assertEnumEqual('JSParseExportEnum', getEnumMap(env.JSParseExportEnum), parseExportEnums)
  assertEnumEqual('JSVarKindEnum', getEnumMap(env.JSVarKindEnum), varKindEnums)
})

test('env: opcode 枚举与定义对齐', async () => {
  const opcodes = await QuickJSLib.getAllOpcodes()

  for (const op of opcodes) {
    const key = `OP_${op.name}`
    if (op.isTemp) {
      assert.equal((env.TempOpcode as Record<string, number>)[key], op.code, `TempOpcode.${key} 值不一致`)
      const def = env.TEMP_OPCODE_DEFS[key]
      assert.ok(def, `TEMP_OPCODE_DEFS.${key} 缺失`)
      assert.equal(def.size, op.size, `TEMP_OPCODE_DEFS.${key}.size 不一致`)
      assert.equal(def.nPop, op.nPop, `TEMP_OPCODE_DEFS.${key}.nPop 不一致`)
      assert.equal(def.nPush, op.nPush, `TEMP_OPCODE_DEFS.${key}.nPush 不一致`)
      assert.equal(def.format, op.fmt, `TEMP_OPCODE_DEFS.${key}.format 不一致`)
      const byCode = env.TEMP_OPCODE_BY_CODE[op.code]
      assert.ok(byCode, `TEMP_OPCODE_BY_CODE.${op.code} 缺失`)
      assert.equal(byCode.id, op.name, `TEMP_OPCODE_BY_CODE.${op.code}.id 不一致`)
    } else {
      assert.equal((env.Opcode as Record<string, number>)[key], op.code, `Opcode.${key} 值不一致`)
      const def = env.OPCODE_DEFS[key]
      assert.ok(def, `OPCODE_DEFS.${key} 缺失`)
      assert.equal(def.size, op.size, `OPCODE_DEFS.${key}.size 不一致`)
      assert.equal(def.nPop, op.nPop, `OPCODE_DEFS.${key}.nPop 不一致`)
      assert.equal(def.nPush, op.nPush, `OPCODE_DEFS.${key}.nPush 不一致`)
      assert.equal(def.format, op.fmt, `OPCODE_DEFS.${key}.format 不一致`)
      const byCode = env.OPCODE_BY_CODE[op.code]
      assert.ok(byCode, `OPCODE_BY_CODE.${op.code} 缺失`)
      assert.equal(byCode.id, op.name, `OPCODE_BY_CODE.${op.code}.id 不一致`)
    }
  }
})

test('env: atoms 对齐', async () => {
  const atoms = await QuickJSLib.getAllAtoms()
  const atomEnum = getEnumMap(env.JSAtom)

  const firstNameById = new Map<number, string>()
  const lastNameById = new Map<number, string>()
  for (const atom of atoms) {
    if (!firstNameById.has(atom.id)) firstNameById.set(atom.id, atom.key)
    lastNameById.set(atom.id, atom.key)
  }

  for (const [id, key] of firstNameById) {
    const enumKey = key === '' || key === 'empty_string'
      ? 'JS_ATOM_empty_string'
      : key === '<private_brand>'
        ? 'JS_ATOM_Private_brand'
        : `JS_ATOM_${key}`

    assert.equal(atomEnum[enumKey], id, `JSAtom.${enumKey} 值不一致`)
  }

  for (const [id, key] of lastNameById) {
    const expectedString = key === '' || key === 'empty_string'
      ? ''
      : key === '<private_brand>'
        ? '<brand>'
        : key

    assert.equal(env.ATOM_STRINGS[id], expectedString, `ATOM_STRINGS[${id}] 不一致`)
  }
})

test('env: 编译环境常量对齐', async () => {
  const [bytecodeVersion, compileOptions, firstAtomId, globalVarOffset, argumentVarOffset, argScopeIndex, argScopeEnd, debugScopeIndex, maxLocalVars, stackSizeMax] = await Promise.all([
    QuickJSLib.getBytecodeVersion(),
    QuickJSLib.getCompileOptions(),
    QuickJSLib.getFirstAtomId(),
    QuickJSLib.getGlobalVarOffset(),
    QuickJSLib.getArgumentVarOffset(),
    QuickJSLib.getArgScopeIndex(),
    QuickJSLib.getArgScopeEnd(),
    QuickJSLib.getDebugScopeIndex(),
    QuickJSLib.getMaxLocalVars(),
    QuickJSLib.getStackSizeMax(),
  ])

  assert.equal(env.BYTECODE_VERSION, bytecodeVersion, 'BYTECODE_VERSION 不一致')
  assert.equal(env.COMPILE_OPTIONS, compileOptions, 'COMPILE_OPTIONS 不一致')
  assert.equal(env.FIRST_ATOM_ID, firstAtomId, 'FIRST_ATOM_ID 不一致')
  assert.equal(env.GLOBAL_VAR_OFFSET, globalVarOffset, 'GLOBAL_VAR_OFFSET 不一致')
  assert.equal(env.ARGUMENT_VAR_OFFSET, argumentVarOffset, 'ARGUMENT_VAR_OFFSET 不一致')
  assert.equal(env.ARG_SCOPE_INDEX, argScopeIndex, 'ARG_SCOPE_INDEX 不一致')
  assert.equal(env.ARG_SCOPE_END, argScopeEnd, 'ARG_SCOPE_END 不一致')
  assert.equal(env.DEBUG_SCOPE_INDEX, debugScopeIndex, 'DEBUG_SCOPE_INDEX 不一致')
  assert.equal(env.JS_MAX_LOCAL_VARS, maxLocalVars, 'JS_MAX_LOCAL_VARS 不一致')
  assert.equal(env.JS_STACK_SIZE_MAX, stackSizeMax, 'JS_STACK_SIZE_MAX 不一致')
})
