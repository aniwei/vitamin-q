import assert from 'node:assert/strict'
import test from 'node:test'

import { AtomTable } from '../../atom/atom-table'
import { ScopeManager } from '../scope-manager'
import { VariableResolver } from '../variable-resolver'
import { ClosureAnalyzer } from '../closure-analyzer'
import { GlobalVarManager } from '../global-var-manager'
import { createEvalState, markEvalCalled, setEvalRetIndex } from '../eval-variables'
import { PrivateFieldManager } from '../private-field'


test('variable: resolver prefers local then arg then var then global', () => {
  const atoms = new AtomTable({ preloadBuiltins: false, firstDynamicAtomId: 1 })
  const scopes = new ScopeManager()
  scopes.pushScope()

  const atomLocal = atoms.getOrAdd('local')
  const atomVar = atoms.getOrAdd('var')
  scopes.addScopeVar(atomLocal, 0)
  scopes.addVar(atomVar)

  const resolver = new VariableResolver(scopes, atoms, new Map([['arg', 0]]))

  assert.equal(resolver.resolveIdentifier('local').kind, 'local')
  assert.equal(resolver.resolveIdentifier('arg').kind, 'arg')
  assert.equal(resolver.resolveIdentifier('var').kind, 'var')
  assert.equal(resolver.resolveIdentifier('global').kind, 'global')
})

test('variable: closure analyzer marks captured', () => {
  const atoms = new AtomTable({ preloadBuiltins: false, firstDynamicAtomId: 1 })
  const scopes = new ScopeManager()
  scopes.pushScope()
  const atom = atoms.getOrAdd('x')
  const idx = scopes.addScopeVar(atom, 0)

  const analyzer = new ClosureAnalyzer(scopes)
  analyzer.analyze([{ atom, scopeLevel: scopes.scopeLevel }])

  assert.equal(scopes.vars[idx].isCaptured, true)
})

test('variable: global var manager add/find', () => {
  const atoms = new AtomTable({ preloadBuiltins: false, firstDynamicAtomId: 1 })
  const manager = new GlobalVarManager()
  const atom = atoms.getOrAdd('g')
  manager.add(atom, { isLexical: true })
  const entry = manager.find(atom)
  assert.ok(entry)
  assert.equal(entry?.isLexical, true)
})

test('variable: eval state helpers', () => {
  const state = createEvalState()
  assert.equal(state.hasEval, false)
  markEvalCalled(state)
  assert.equal(state.hasEval, true)
  setEvalRetIndex(state, 3)
  assert.equal(state.evalRetIdx, 3)
})

test('variable: private field manager', () => {
  const manager = new PrivateFieldManager()
  const binding = manager.define('#x', 'field')
  assert.equal(binding.index, 0)
  assert.equal(manager.get('#x')?.kind, 'field')
})
