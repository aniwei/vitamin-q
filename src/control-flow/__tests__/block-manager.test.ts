import assert from 'node:assert/strict'
import test from 'node:test'

import { JSAtom, JS_ATOM_NULL, JSVarKindEnum } from '../../env'
import { createBlockEnv } from '../block-env'
import { BlockManager } from '../block-manager'
import { createWithScopeVar } from '../with-scope'
import { ScopeManager } from '../../emitter/scope-manager'

test('control-flow: createBlockEnv defaults', () => {
  const env = createBlockEnv()
  assert.equal(env.prev, null)
  assert.equal(env.labelName, JS_ATOM_NULL)
  assert.equal(env.labelBreak, -1)
  assert.equal(env.labelCont, -1)
  assert.equal(env.dropCount, 0)
  assert.equal(env.labelFinally, -1)
  assert.equal(env.scopeLevel, 0)
  assert.equal(env.hasIterator, false)
  assert.equal(env.isRegularStmt, false)
})

test('control-flow: BlockManager push/pop/iterate', () => {
  const manager = new BlockManager()
  const first = createBlockEnv({ labelName: JSAtom.JS_ATOM_for })
  const second = createBlockEnv({ labelName: JSAtom.JS_ATOM_if })

  manager.push(first)
  manager.push(second)

  assert.equal(manager.peek(), second)
  const iter = Array.from(manager.iterate())
  assert.deepEqual(iter, [second, first])

  assert.equal(manager.pop(), second)
  assert.equal(manager.peek(), first)
  assert.equal(manager.pop(), first)
  assert.equal(manager.peek(), null)
})

test('control-flow: createWithScopeVar registers scope var', () => {
  const scopes = new ScopeManager()
  scopes.pushScope()

  const { atom, localIdx } = createWithScopeVar(scopes)
  const vd = scopes.vars[localIdx]

  assert.equal(atom, JSAtom.JS_ATOM__with_)
  assert.equal(vd.varName, atom)
  assert.equal(vd.scopeLevel, scopes.scopeLevel)
  assert.equal(vd.varKind, JSVarKindEnum.JS_VAR_NORMAL)
  assert.equal(scopes.scopes[scopes.scopeLevel].first, localIdx)
})
