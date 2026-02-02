import assert from 'node:assert/strict'
import test from 'node:test'

import { parseSource } from '../../ast/parser'
import { AtomTable } from '../../atom/atom-table'
import { parseModule } from '../module-parser'
import { QuickJSLib } from '../../../scripts/QuickJSLib'

const getName = (atoms: AtomTable, atom: number): string => atoms.getAtomName(atom) ?? ''

test('module: wasm scenario aligns with parser', async () => {
  const source = parseSource('import { foo } from "mod"; export { foo as bar };', { fileName: 'mod.ts' })
  const atoms = new AtomTable({ preloadBuiltins: false, firstDynamicAtomId: 1 })
  const parsed = parseModule(source, atoms)

  const imports = parsed.entries.importEntries.map(entry => ({
    moduleName: getName(atoms, parsed.entries.reqModuleEntries[entry.reqModuleIdx].moduleName),
    importName: getName(atoms, entry.importName),
    isStar: entry.isStar ? 1 : 0,
  }))

  const exports = parsed.entries.exportEntries.map(entry => ({
    localName: getName(atoms, entry.localName),
    exportName: getName(atoms, entry.exportName),
    exportType: entry.exportType,
  }))

  const wasm = await QuickJSLib.getModuleScenario()
  assert.deepEqual(imports, wasm.imports)
  assert.deepEqual(exports, wasm.exports)
})
