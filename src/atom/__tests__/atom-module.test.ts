import assert from 'node:assert/strict'
import test from 'node:test'

import { JSAtom, JSVarKindEnum } from '../../env'
import { AtomTable } from '../atom-table'
import { getPredefinedAtoms } from '../predefined-atoms'
import { getOrAddAtom, dupAtom, freeAtom, getAtomName } from '../atom-ops'
import { serializeAtoms, hydrateAtoms } from '../atom-serializer'
import { defineScopeVarFromName } from '../atom-variable'
import { ScopeManager } from '../../emitter/scope-manager'

test('atom: predefined atoms include builtins', () => {
  const atoms = getPredefinedAtoms()
  const withAtom = atoms.find(entry => entry.id === JSAtom.JS_ATOM__with_)
  assert.ok(withAtom)
  assert.equal(withAtom?.name, '_with_')
})

test('atom: atom ops basic flow', () => {
  const table = new AtomTable({ preloadBuiltins: false, firstDynamicAtomId: 1 })
  const atomA = getOrAddAtom(table, 'a')
  const atomA2 = getOrAddAtom(table, 'a')
  assert.equal(atomA, atomA2)
  assert.equal(getAtomName(table, atomA), 'a')

  const before = table.getRefCount(atomA)
  dupAtom(table, atomA)
  assert.equal(table.getRefCount(atomA), before + 1)

  freeAtom(table, atomA)
  assert.equal(table.getRefCount(atomA), Math.max(0, before))
})

test('atom: serialize and hydrate', () => {
  const table = new AtomTable({ preloadBuiltins: false, firstDynamicAtomId: 1 })
  const atomA = getOrAddAtom(table, 'a')

  const snapshot = serializeAtoms(table)
  const restored = new AtomTable({ preloadBuiltins: false, firstDynamicAtomId: 1 })
  hydrateAtoms(restored, snapshot)

  assert.equal(restored.getAtomName(atomA), 'a')
})

test('atom: defineScopeVarFromName registers scope var', () => {
  const table = new AtomTable({ preloadBuiltins: false, firstDynamicAtomId: 1 })
  const scopes = new ScopeManager()
  scopes.pushScope()

  const { atom, localIdx } = defineScopeVarFromName(scopes, table, 'x', JSVarKindEnum.JS_VAR_NORMAL)
  const vd = scopes.vars[localIdx]

  assert.equal(vd.varName, atom)
  assert.equal(vd.scopeLevel, scopes.scopeLevel)
  assert.equal(vd.varKind, JSVarKindEnum.JS_VAR_NORMAL)
})
