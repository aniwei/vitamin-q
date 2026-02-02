import assert from 'node:assert/strict'
import test from 'node:test'

import { parseSource } from '../../ast/parser'
import { AtomTable } from '../../atom/atom-table'
import { detectModule } from '../module-detect'
import { parseModule } from '../module-parser'
import { addModuleVariables } from '../module-variables'


test('module: detectModule finds import/export', () => {
  const source = parseSource('import { foo } from "mod"; export const bar = 1;', { fileName: 'mod.ts' })
  assert.equal(detectModule(source), true)
})

test('module: parseModule collects entries', () => {
  const source = parseSource('import { foo as bar } from "mod"; export { bar };', { fileName: 'mod.ts' })
  const atoms = new AtomTable({ preloadBuiltins: false })
  const result = parseModule(source, atoms)

  assert.equal(result.entries.reqModuleEntries.length, 1)
  assert.equal(result.entries.importEntries.length, 1)
  assert.equal(result.entries.exportEntries.length, 1)
})

test('module: addModuleVariables collects local exports', () => {
  const source = parseSource('export const foo = 1;', { fileName: 'mod.ts' })
  const atoms = new AtomTable({ preloadBuiltins: false })
  const result = parseModule(source, atoms)
  const vars = addModuleVariables(result.entries)
  assert.equal(vars.length, 1)
})
