import assert from 'node:assert/strict'
import test from 'node:test'

import { ScopeManager } from '../scope-manager'
import { JSVarKindEnum } from '../../env'

const atom = (id: number) => id

test('scope: push/pop 更新 scopeLevel/first', () => {
  const scopes = new ScopeManager()
  assert.equal(scopes.scopeLevel, -1)

  const scope0 = scopes.pushScope()
  assert.equal(scope0, 0)
  assert.equal(scopes.scopeLevel, 0)
  assert.equal(scopes.scopes[0].parent, -1)

  const scope1 = scopes.pushScope()
  assert.equal(scope1, 1)
  assert.equal(scopes.scopes[1].parent, 0)

  scopes.popScope()
  assert.equal(scopes.scopeLevel, 0)

  scopes.popScope()
  assert.equal(scopes.scopeLevel, -1)
})

test('scope: addScopeVar 建立链表', () => {
  const scopes = new ScopeManager()
  scopes.pushScope()

  const first = scopes.addScopeVar(atom(10), JSVarKindEnum.JS_VAR_NORMAL)
  const second = scopes.addScopeVar(atom(20), JSVarKindEnum.JS_VAR_NORMAL)

  assert.equal(scopes.scopes[0].first, second)
  assert.equal(scopes.vars[second].scopeNext, first)
  assert.equal(scopes.vars[first].scopeNext, -1)
})

test('scope: findVarInScope', () => {
  const scopes = new ScopeManager()
  scopes.pushScope()
  const idx = scopes.addScopeVar(atom(42), JSVarKindEnum.JS_VAR_NORMAL)
  assert.equal(scopes.findVarInScope(atom(42), 0), idx)
  assert.equal(scopes.findVarInScope(atom(1), 0), -1)
})
