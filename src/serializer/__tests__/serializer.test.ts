import assert from 'node:assert/strict'
import test from 'node:test'

import { AtomTable } from '../../atom/atom-table'
import { JS_WriteObjectRec } from '../value-writer'
import { JS_ReadObjectRec } from '../value-reader'
import {
  bcPutLeb128,
  bcPutSleb128,
  bcPutU16,
  bcPutU32,
  bcPutU64,
  bcPutU8,
  createWriterState,
  toUint8Array,
} from '../bytecode-writer'
import {
  bcGetLeb128,
  bcGetSleb128,
  bcGetU16,
  bcGetU32,
  bcGetU64,
  bcGetU8,
  createReaderState,
} from '../bytecode-reader'
import { createAtomWriteState } from '../atom-writer'
import { JS_WriteFunctionTag } from '../function-writer'
import { JS_ReadFunctionTag } from '../function-reader'
import { JS_WriteModule } from '../module-writer'
import { JS_ReadModule } from '../module-reader'


test('serializer: bytecode writer/reader roundtrip', () => {
  const writer = createWriterState()
  bcPutU8(writer, 0xaa)
  bcPutU16(writer, 0x1234)
  bcPutU32(writer, 0x89abcdef)
  bcPutU64(writer, 0x1122334455667788n)
  bcPutLeb128(writer, 300)
  bcPutSleb128(writer, -42)

  const reader = createReaderState(toUint8Array(writer))
  assert.equal(bcGetU8(reader), 0xaa)
  assert.equal(bcGetU16(reader), 0x1234)
  assert.equal(bcGetU32(reader), 0x89abcdef)
  assert.equal(bcGetU64(reader), 0x1122334455667788n)
  assert.equal(bcGetLeb128(reader), 300)
  assert.equal(bcGetSleb128(reader), -42)
})

test('serializer: value roundtrip', () => {
  const writer = createWriterState()
  const value = { foo: 'bar', nums: [1, 2], flag: true }
  JS_WriteObjectRec(writer, value)

  const reader = createReaderState(toUint8Array(writer))
  const decoded = JS_ReadObjectRec(reader)
  assert.deepEqual(decoded, value)
})

test('serializer: function roundtrip', () => {
  const table = new AtomTable({ preloadBuiltins: false })
  const atomState = createAtomWriteState(table)
  const filename = table.getOrAdd('test.js')

  const writer = createWriterState()
  JS_WriteFunctionTag(writer, atomState, {
    flags: {
      hasDebug: true,
      readOnlyBytecode: false,
      isDirectOrIndirectEval: false,
    },
    byteCode: Uint8Array.from([1, 2, 3]),
    cpool: [],
    vardefs: {
      argCount: 1,
      varCount: 2,
      vardefs: [],
    },
    closure: {
      closureVarCount: 0,
      closureVar: [],
    },
    debug: {
      filename,
      pc2lineBuf: Uint8Array.from([0, 1]),
    },
    source: null,
  })

  const reader = createReaderState(toUint8Array(writer))
  const decoded = JS_ReadFunctionTag(reader, atomState.idxToAtom)
  assert.equal(decoded.flags.hasDebug, true)
  assert.equal(decoded.byteCode.length, 3)
  assert.equal(decoded.vardefs.argCount, 1)
})

test('serializer: module roundtrip', () => {
  const table = new AtomTable({ preloadBuiltins: false })
  const atomState = createAtomWriteState(table)
  const moduleName = table.getOrAdd('mod')
  const entryName = table.getOrAdd('foo')

  const writer = createWriterState()
  JS_WriteModule(writer, atomState, {
    moduleName,
    reqModuleEntries: [
      {
        moduleName: entryName,
        module: null,
        attributes: { type: 'json' },
      },
    ],
    exportEntries: [
      {
        exportType: 0,
        localName: entryName,
        exportName: entryName,
        u: { local: { varIdx: 1, varRef: null } },
      },
    ],
    starExportEntries: [{ reqModuleIdx: 0 }],
    importEntries: [
      {
        varIdx: 0,
        isStar: false,
        importName: entryName,
        reqModuleIdx: 0,
      },
    ],
  })

  const reader = createReaderState(toUint8Array(writer))
  const decoded = JS_ReadModule(reader, atomState.idxToAtom)
  assert.equal(decoded.moduleName, moduleName)
  assert.equal(decoded.reqModuleEntries.length, 1)
  assert.equal(decoded.exportEntries.length, 1)
  assert.equal(decoded.importEntries.length, 1)
})
