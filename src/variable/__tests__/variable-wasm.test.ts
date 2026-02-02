import assert from 'node:assert/strict'
import test from 'node:test'

import { QuickJSLib } from '../../../scripts/QuickJSLib'
import { JSVarKindEnum } from '../../env'
import { ScopeManager } from '../scope-manager'


test('variable: ScopeManager aligns with wasm scenario', async () => {
  const atomA = 100
  const atomB = 200
  const atomC = 300
  const kindA = JSVarKindEnum.JS_VAR_FUNCTION_DECL
  const kindB = JSVarKindEnum.JS_VAR_CATCH
  const kindC = JSVarKindEnum.JS_VAR_NORMAL

  const manager = new ScopeManager()
  manager.pushScope()
  manager.addScopeVar(atomA, kindA)
  manager.pushScope()
  manager.addScopeVar(atomB, kindB)
  manager.popScope()
  manager.addScopeVar(atomC, kindC)

  const wasm = await QuickJSLib.getScopeManagerScenario(atomA, atomB, atomC, kindA, kindB, kindC)
  const snapshot = manager.snapshot()
  const vars = snapshot.vars.map(v => ({
    varName: v.varName,
    scopeLevel: v.scopeLevel,
    scopeNext: v.scopeNext,
    varKind: v.varKind,
  }))
  const scopes = snapshot.scopes.map(s => ({ parent: s.parent, first: s.first }))

  assert.deepEqual(vars, wasm.vars)
  assert.deepEqual(scopes, wasm.scopes)
  assert.equal(snapshot.scopeLevel, wasm.scopeLevel)
  assert.equal(snapshot.scopeFirst, wasm.scopeFirst)
})
