import assert from 'node:assert/strict'
import test from 'node:test'
import ts from 'typescript'

import { parseSource } from '../parser'
import { traverseSourceFile } from '../visitor'
import { createLineColCache, getPositionLocation } from '../source-location'
import { AstDispatcher } from '../dispatcher'

test('ast: parseSource 支持 TS/JS 脚本类型', () => {
  const tsFile = parseSource('const a = 1', { fileName: 'demo.ts' })
  const jsFile = parseSource('const b = 2', { fileName: 'demo.js' })

  const tsKind = (tsFile as ts.SourceFile & { scriptKind?: ts.ScriptKind }).scriptKind
  const jsKind = (jsFile as ts.SourceFile & { scriptKind?: ts.ScriptKind }).scriptKind

  assert.equal(tsKind, ts.ScriptKind.TS)
  assert.equal(jsKind, ts.ScriptKind.JS)
})

test('ast: visitor 遍历上下文与深度', () => {
  const file = parseSource('function foo() { return 1 }', { fileName: 'demo.ts' })
  let returnParent: ts.SyntaxKind | undefined
  let maxDepth = 0

  traverseSourceFile(file, {
    enter(node, context) {
      maxDepth = Math.max(maxDepth, context.depth)
      if (ts.isReturnStatement(node)) {
        returnParent = context.getParent()?.kind
      }
    },
  })

  assert.equal(returnParent, ts.SyntaxKind.Block)
  assert.ok(maxDepth > 0)
})

test('ast: source-location 行列缓存与回退', () => {
  const text = 'a\n𠮷b'
  const file = ts.createSourceFile('demo.ts', text, ts.ScriptTarget.ES2020, true)
  const cache = createLineColCache(text)

  const posB = text.indexOf('b')
  const locB = getPositionLocation(file, posB, cache)
  assert.deepEqual(locB, { line: 1, column: 1 })

  const locStart = getPositionLocation(file, 0, cache)
  assert.deepEqual(locStart, { line: 0, column: 0 })
})

test('ast: dispatcher 按类别分发', () => {
  const file = parseSource('function foo() { 1 }', { fileName: 'demo.ts' })
  const fnDecl = file.statements[0] as ts.FunctionDeclaration
  const exprStmt = fnDecl.body?.statements[0] as ts.ExpressionStatement
  const literal = exprStmt.expression

  const calls: string[] = []
  const dispatcher = new AstDispatcher<{ calls: string[] }, void>()

  dispatcher.registerDeclaration(ts.SyntaxKind.FunctionDeclaration, (_node, ctx) => {
    ctx.calls.push('decl')
  })
  dispatcher.registerStatement(ts.SyntaxKind.ExpressionStatement, (_node, ctx) => {
    ctx.calls.push('stmt')
  })
  dispatcher.registerExpression(ts.SyntaxKind.NumericLiteral, (_node, ctx) => {
    ctx.calls.push('expr')
  })

  dispatcher.dispatch(fnDecl, { calls })
  dispatcher.dispatch(exprStmt, { calls })
  dispatcher.dispatch(literal, { calls })

  assert.deepEqual(calls, ['decl', 'stmt', 'expr'])
})
