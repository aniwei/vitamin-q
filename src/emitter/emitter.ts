import ts from 'typescript'

import { JSAtom, Opcode, TempOpcode } from '../env'

import { BytecodeBuffer } from './bytecode-buffer'
import type { AtomTable } from './atom-table'
import { InlineCacheManager } from './inline-cache'
import { LabelManager } from './label-manager'
import { ConstantPoolManager } from './constant-pool'
import { ExpressionEmitter } from './expressions'
import { StatementEmitter } from './statements'
import { ScopeManager } from './scope-manager'

import { AstDispatcher } from '../ast/dispatcher'
import { createLineColCache, getByteOffset } from '../ast/source-location'

export interface InlineCacheWriter {
  addSlot1: (atom: JSAtom) => void
}

export interface BytecodeEmitterOptions {
  bytecode?: BytecodeBuffer
  atomTable?: AtomTable
  dupAtom?: (atom: JSAtom) => JSAtom
  inlineCache?: InlineCacheWriter
}

/**
 * 字节码发射器（基础 emit_* API）。
 *
 * @source QuickJS/src/core/parser.c:1768-1813
 * @see emit_u8
 */
export class BytecodeEmitter {
  readonly bytecode: BytecodeBuffer
  lastOpcodePos = 0
  private lastOpcodeSourcePos = -1
  private dupAtom?: (atom: JSAtom) => JSAtom
  private inlineCache?: InlineCacheWriter

  constructor(options: BytecodeEmitterOptions = {}) {
    this.bytecode = options.bytecode ?? new BytecodeBuffer()
    this.dupAtom = options.dupAtom ?? options.atomTable?.dupAtom.bind(options.atomTable)
    this.inlineCache = options.inlineCache
  }

  /**
   * 发射 u8。
   *
   * @source QuickJS/src/core/parser.c:1768-1771
   * @see emit_u8
   */
  emitU8(value: number) {
    this.bytecode.writeU8(value)
  }

  /**
   * 发射 u16。
   *
   * @source QuickJS/src/core/parser.c:1773-1776
   * @see emit_u16
   */
  emitU16(value: number) {
    this.bytecode.writeU16(value)
  }

  /**
   * 发射 u32。
   *
   * @source QuickJS/src/core/parser.c:1778-1781
   * @see emit_u32
   */
  emitU32(value: number) {
    this.bytecode.writeU32(value)
  }

  /**
   * 发射操作码。
   *
   * @source QuickJS/src/core/parser.c:1796-1804
   * @see emit_op
   */
  emitOp(opcode: number) {
    this.lastOpcodePos = this.bytecode.length
    this.emitU8(opcode)
  }

  /**
   * 发射源码位置（OP_line_num）。
   *
   * @source QuickJS/src/core/parser.c:1783-1795
   * @see emit_source_pos
   */
  emitSourcePos(sourcePos: number) {
    if (this.lastOpcodeSourcePos === sourcePos) return
    this.emitOp(TempOpcode.OP_line_num)
    this.emitU32(sourcePos)
    this.lastOpcodeSourcePos = sourcePos
  }

  /**
   * 发射 Atom。
   *
   * @source QuickJS/src/core/parser.c:1805-1813
   * @see emit_atom
   */
  emitAtom(atom: JSAtom) {
    const value = this.dupAtom ? this.dupAtom(atom) : atom
    this.emitU32(value)
  }

  /**
   * 记录 Inline Cache。
   *
   * @source QuickJS/src/core/parser.c:1815-1823
   * @see emit_ic
   */
  emitIC(atom: JSAtom) {
    this.inlineCache?.addSlot1(atom)
  }

  /**
   * 获取当前字节码长度。
   *
   * @source QuickJS/src/core/parser.c:1796-1804
   * @see emit_op
   */
  getBytecodeSize() {
    return this.bytecode.length
  }
}

export interface EmitterContextOptions {
  sourceFile: ts.SourceFile
  bytecode?: BytecodeBuffer
  atomTable?: AtomTable
  inlineCache?: InlineCacheManager
  constantPool?: ConstantPoolManager
  argMap?: Map<string, number>
  inFunction?: boolean
  inArrow?: boolean
  inAsync?: boolean
  inGenerator?: boolean
  inStrict?: boolean
  privateBindings?: Map<string, { index: number; kind: 'field' | 'method' | 'accessor' }>
}

/**
 * 发射器上下文。
 *
 * @source QuickJS/src/core/parser.c:1768-1813
 * @see emit_op
 */
export class EmitterContext {
  readonly sourceFile: ts.SourceFile
  readonly bytecode: BytecodeEmitter
  readonly labels: LabelManager
  readonly inlineCache: InlineCacheManager
  readonly constantPool: ConstantPoolManager
  readonly scopes: ScopeManager
  readonly atomTable?: AtomTable
  readonly argMap: Map<string, number>
  readonly inFunction: boolean
  readonly inArrow: boolean
  readonly inAsync: boolean
  readonly inGenerator: boolean
  readonly inStrict: boolean
  readonly privateBindings?: Map<string, { index: number; kind: 'field' | 'method' | 'accessor' }>
  private liveCode = true
  private lineColCache
  private nextTempLocal = 1
  private specialVars = new Map<string, number>()
  private iteratorDepth = 0

  constructor(options: EmitterContextOptions) {
    this.sourceFile = options.sourceFile
    this.inlineCache = options.inlineCache ?? new InlineCacheManager()
    this.constantPool = options.constantPool ?? new ConstantPoolManager()
    this.scopes = new ScopeManager()
    this.scopes.addVar(JSAtom.JS_ATOM__ret_)
    this.atomTable = options.atomTable
    this.argMap = options.argMap ?? new Map()
    this.inFunction = options.inFunction ?? false
    this.inArrow = options.inArrow ?? false
    this.inAsync = options.inAsync ?? false
    this.inGenerator = options.inGenerator ?? false
    this.inStrict = options.inStrict ?? false
    this.privateBindings = options.privateBindings
    this.bytecode = new BytecodeEmitter({
      bytecode: options.bytecode,
      atomTable: options.atomTable,
      inlineCache: this.inlineCache,
    })
    this.labels = new LabelManager({
      emitOp: (opcode) => this.bytecode.emitOp(opcode),
      emitU32: (value) => this.bytecode.emitU32(value),
      getBytecodeSize: () => this.bytecode.getBytecodeSize(),
      isLiveCode: () => this.liveCode,
    })
    this.lineColCache = createLineColCache(this.sourceFile.text)
  }

  pushIterator() {
    this.iteratorDepth += 1
  }

  popIterator() {
    if (this.iteratorDepth > 0) {
      this.iteratorDepth -= 1
    }
  }

  hasIterator() {
    return this.iteratorDepth > 0
  }

  /**
   * 进入作用域。
   *
   * @source QuickJS/src/core/parser.c:2050-2085
   * @see push_scope
   */
  pushScope() {
    const scope = this.scopes.pushScope()
    this.bytecode.emitOp(TempOpcode.OP_enter_scope)
    this.bytecode.emitU16(scope)
    return scope
  }

  /**
   * 离开作用域。
   *
   * @source QuickJS/src/core/parser.c:2097-2120
   * @see pop_scope
   */
  popScope() {
    const scope = this.scopes.popScope()
    if (scope >= 0) {
      this.bytecode.emitOp(TempOpcode.OP_leave_scope)
      this.bytecode.emitU16(scope)
    }
    return scope
  }

  /**
   * 标记是否为可达代码段。
   *
   * @source QuickJS/src/core/parser.c:1720-1756
   * @see js_is_live_code
   */
  setLiveCode(isLive: boolean) {
    this.liveCode = isLive
  }

  /**
   * 根据节点发射源码位置。
   *
   * @source QuickJS/src/core/parser.c:1783-1795
   * @see emit_source_pos
   */
  emitSourcePos(node: ts.Node) {
    const start = node.getStart(this.sourceFile)
    const bytePos = getByteOffset(this.sourceFile.text, start)
    this.bytecode.emitSourcePos(bytePos)
    return getByteOffset(this.sourceFile.text, start)
  }

  /**
   * 获取/创建原子。
   *
   * @source QuickJS/src/core/string-utils.c:577-590
   * @see __JS_NewAtomInit
   */
  getAtom(name: string): JSAtom {
    if (!this.atomTable) {
      throw new Error('AtomTable 未注入，无法创建原子')
    }
    return this.atomTable.getOrAdd(name)
  }

  getArgIndex(name: string): number {
    const index = this.argMap.get(name)
    return index === undefined ? -1 : index
  }

  getPrivateBinding(name: string): { index: number; kind: 'field' | 'method' | 'accessor' } | undefined {
    return this.privateBindings?.get(name)
  }

  /**
   * 查找最近的 with 作用域变量索引。
   */
  findWithVarIndex(): number {
    let scopeLevel = this.scopes.scopeLevel
    while (scopeLevel >= 0) {
      let cursor = this.scopes.scopes[scopeLevel].first
      while (cursor >= 0) {
        const vd = this.scopes.vars[cursor]
        if (vd.varName === JSAtom.JS_ATOM__with_) {
          return cursor
        }
        if (vd.scopeLevel !== scopeLevel) break
        cursor = vd.scopeNext
      }
      scopeLevel = this.scopes.scopes[scopeLevel].parent
    }
    return -1
  }

  hasWithScope(): boolean {
    return this.findWithVarIndex() >= 0
  }

  /**
   * 获取行列缓存（用于测试或调试）。
   *
   * @source QuickJS/src/core/parser.c:151-193
   * @see get_line_col_cached
   */
  getLineColCache() {
    return this.lineColCache
  }

  /**
   * 分配临时本地变量索引（保留 0 用于 <ret>）。
   */
  allocateTempLocal(): number {
    const idx = this.nextTempLocal
    this.nextTempLocal += 1
    return idx
  }

  setSpecialVar(name: string, index: number) {
    this.specialVars.set(name, index)
  }

  getSpecialVar(name: string): number | undefined {
    return this.specialVars.get(name)
  }
}

export interface BytecodeCompilerOptions {
  atomTable?: AtomTable
  inlineCache?: InlineCacheManager
  constantPool?: ConstantPoolManager
  bytecode?: BytecodeBuffer
  expressionStatementDrop?: boolean
  strict?: boolean
}

export interface BytecodeCompilerState {
  bytecode: BytecodeBuffer
  labels: LabelManager
  scopes: ScopeManager
  inlineCache: InlineCacheManager
  constantPool: ConstantPoolManager
}

/**
 * 主发射器（基于 AST 分发）。
 *
 * @source QuickJS/src/core/parser.c:6939-7078
 * @see js_parse_statement_or_decl
 */
export class BytecodeCompiler {
  private dispatcher: AstDispatcher<EmitterContext, void>
  private options: BytecodeCompilerOptions
  private expressionEmitter: ExpressionEmitter
  private statementEmitter: StatementEmitter

  constructor(options: BytecodeCompilerOptions = {}) {
    this.options = options
    this.dispatcher = new AstDispatcher<EmitterContext, void>()
    this.expressionEmitter = new ExpressionEmitter()
    this.statementEmitter = new StatementEmitter()
    this.dispatcher.setFallback((node) => {
      throw new Error(`未实现节点发射: ${ts.SyntaxKind[node.kind]}`)
    })
    this.registerCoreHandlers()
  }

  /**
   * 编译 SourceFile。
   *
   * @source QuickJS/src/core/parser.c:13617-13663
   * @see js_parse_program
   */
  compile(sourceFile: ts.SourceFile): BytecodeBuffer {
    const state = this.compileWithState(sourceFile)
    return state.bytecode
  }

  compileWithState(sourceFile: ts.SourceFile): BytecodeCompilerState {
    const isModule = ts.isExternalModule(sourceFile)
    const hasUseStrict = this.hasUseStrictDirective(sourceFile)
    const inStrict = (this.options.strict ?? hasUseStrict) || isModule
    const context = new EmitterContext({
      sourceFile,
      atomTable: this.options.atomTable,
      inlineCache: this.options.inlineCache,
      constantPool: this.options.constantPool,
      bytecode: this.options.bytecode,
      inStrict,
    })
    const hasTopLevelThis = this.hasTopLevelThis(sourceFile)
    if (!context.inFunction && !isModule && hasTopLevelThis) {
      const thisIdx = context.allocateTempLocal()
      context.bytecode.emitOp(Opcode.OP_push_this)
      context.bytecode.emitOp(Opcode.OP_put_loc)
      context.bytecode.emitU16(thisIdx)
      context.setSpecialVar('this', thisIdx)
    }

    this.compileStatements(sourceFile.statements, context)
    return {
      bytecode: context.bytecode.bytecode,
      labels: context.labels,
      scopes: context.scopes,
      inlineCache: context.inlineCache,
      constantPool: context.constantPool,
    }
  }

  private hasUseStrictDirective(sourceFile: ts.SourceFile): boolean {
    for (const stmt of sourceFile.statements) {
      if (!ts.isExpressionStatement(stmt)) return false
      const expr = stmt.expression
      if (!ts.isStringLiteral(expr)) return false
      if (expr.text === 'use strict') return true
    }
    return false
  }

  compileStatements(statements: readonly ts.Statement[], context: EmitterContext) {
    const hoisted = new Set<ts.Statement>()
    for (const stmt of statements) {
      if (ts.isFunctionDeclaration(stmt)) {
        this.dispatcher.dispatch(stmt, context)
        hoisted.add(stmt)
      }
    }
    for (const stmt of statements) {
      if (hoisted.has(stmt)) continue
      this.dispatcher.dispatch(stmt, context)
    }
  }

  emitExpression(node: ts.Expression, context: EmitterContext) {
    this.expressionEmitter.emitExpression(node, context)
  }

  /**
   * 注册最基础的语句/表达式处理器。
   *
   * @source QuickJS/src/core/parser.c:6939-7078
   * @see js_parse_statement_or_decl
   */
  private registerCoreHandlers() {
    this.dispatcher.registerStatement(ts.SyntaxKind.Block, (node, context) => {
      const block = node as ts.Block
      const needsScope = this.blockNeedsScope(block)
      if (needsScope) {
        context.pushScope()
      }
      this.compileStatements(block.statements, context)
      if (needsScope) {
        context.popScope()
      }
    })

    this.dispatcher.registerStatement(ts.SyntaxKind.EmptyStatement, () => {
      // 空语句不产生字节码
    })

    this.dispatcher.registerStatement(ts.SyntaxKind.ExpressionStatement, (node, context) => {
      const stmt = node as ts.ExpressionStatement
      context.emitSourcePos(stmt)
      const expr = stmt.expression
      if (this.options.expressionStatementDrop && context.inStrict) {
        if (ts.isBinaryExpression(expr) && this.isStatementAssignmentOperator(expr.operatorToken.kind)) {
          this.expressionEmitter.emitAssignmentExpression(expr, context, false)
          return
        }
        if (
          (ts.isPrefixUnaryExpression(expr) || ts.isPostfixUnaryExpression(expr)) &&
          (expr.operator === ts.SyntaxKind.PlusPlusToken || expr.operator === ts.SyntaxKind.MinusMinusToken)
        ) {
          this.expressionEmitter.emitUpdateExpressionAsStatement(expr, context)
          return
        }
      }
      this.dispatcher.dispatch(expr, context)
      if (
        this.options.expressionStatementDrop &&
        !(
          ts.isYieldExpression(expr) &&
          expr.asteriskToken &&
          context.inGenerator
        )
      ) {
        context.bytecode.emitOp(Opcode.OP_drop)
      }
    })

    this.dispatcher.registerStatement(ts.SyntaxKind.IfStatement, (node, context) => {
      this.statementEmitter.emitIfStatement(
        node as ts.IfStatement,
        context,
        (expr, ctx) => this.expressionEmitter.emitExpression(expr, ctx),
        (stmt, ctx) => this.dispatcher.dispatch(stmt, ctx),
      )
    })

    this.dispatcher.registerStatement(ts.SyntaxKind.VariableStatement, (node, context) => {
      this.statementEmitter.emitVariableStatement(
        node as ts.VariableStatement,
        context,
        (expr, ctx) => this.expressionEmitter.emitExpression(expr, ctx),
      )
    })

    this.dispatcher.registerDeclaration(ts.SyntaxKind.VariableStatement, (node, context) => {
      this.statementEmitter.emitVariableStatement(
        node as unknown as ts.VariableStatement,
        context,
        (expr, ctx) => this.expressionEmitter.emitExpression(expr, ctx),
      )
    })

    this.dispatcher.registerStatement(ts.SyntaxKind.ReturnStatement, (node, context) => {
      this.statementEmitter.emitReturnStatement(
        node as ts.ReturnStatement,
        context,
        (expr, ctx) => this.expressionEmitter.emitExpression(expr, ctx),
      )
    })

    this.dispatcher.registerStatement(ts.SyntaxKind.ThrowStatement, (node, context) => {
      this.statementEmitter.emitThrowStatement(
        node as ts.ThrowStatement,
        context,
        (expr, ctx) => this.expressionEmitter.emitExpression(expr, ctx),
      )
    })

    this.dispatcher.registerStatement(ts.SyntaxKind.TryStatement, (node, context) => {
      this.statementEmitter.emitTryStatement(
        node as ts.TryStatement,
        context,
        (expr, ctx) => this.expressionEmitter.emitExpression(expr, ctx),
        (stmt, ctx) => this.dispatcher.dispatch(stmt, ctx),
      )
    })

    this.dispatcher.registerStatement(ts.SyntaxKind.DebuggerStatement, (node, context) => {
      this.statementEmitter.emitDebuggerStatement(node as ts.DebuggerStatement, context)
    })

    this.dispatcher.registerStatement(ts.SyntaxKind.FunctionDeclaration, (node, context) => {
      this.statementEmitter.emitFunctionDeclaration(node as ts.FunctionDeclaration, context)
    })

    this.dispatcher.registerDeclaration(ts.SyntaxKind.FunctionDeclaration, (node, context) => {
      this.statementEmitter.emitFunctionDeclaration(node as ts.FunctionDeclaration, context)
    })

    this.dispatcher.registerStatement(ts.SyntaxKind.ClassDeclaration, (node, context) => {
      this.statementEmitter.emitClassDeclaration(
        node as ts.ClassDeclaration,
        context,
        (expr, ctx) => this.expressionEmitter.emitExpression(expr, ctx),
      )
    })

    this.dispatcher.registerDeclaration(ts.SyntaxKind.ClassDeclaration, (node, context) => {
      this.statementEmitter.emitClassDeclaration(
        node as ts.ClassDeclaration,
        context,
        (expr, ctx) => this.expressionEmitter.emitExpression(expr, ctx),
      )
    })

    this.dispatcher.registerStatement(ts.SyntaxKind.WithStatement, (node, context) => {
      this.statementEmitter.emitWithStatement(
        node as ts.WithStatement,
        context,
        (expr, ctx) => this.expressionEmitter.emitExpression(expr, ctx),
        (stmt, ctx) => this.dispatcher.dispatch(stmt, ctx),
      )
    })

    this.dispatcher.registerStatement(ts.SyntaxKind.WhileStatement, (node, context) => {
      this.statementEmitter.emitWhileStatement(
        node as ts.WhileStatement,
        context,
        (expr, ctx) => this.expressionEmitter.emitExpression(expr, ctx),
        (stmt, ctx) => this.dispatcher.dispatch(stmt, ctx),
      )
    })

    this.dispatcher.registerStatement(ts.SyntaxKind.DoStatement, (node, context) => {
      this.statementEmitter.emitDoWhileStatement(
        node as ts.DoStatement,
        context,
        (expr, ctx) => this.expressionEmitter.emitExpression(expr, ctx),
        (stmt, ctx) => this.dispatcher.dispatch(stmt, ctx),
      )
    })

    this.dispatcher.registerStatement(ts.SyntaxKind.ForStatement, (node, context) => {
      const emitExpressionAsStatement = (expr: ts.Expression, ctx: EmitterContext) => {
        if (ts.isBinaryExpression(expr) && this.isStatementAssignmentOperator(expr.operatorToken.kind)) {
          this.expressionEmitter.emitAssignmentExpression(expr, ctx, false)
          return
        }
        if (
          (ts.isPrefixUnaryExpression(expr) || ts.isPostfixUnaryExpression(expr)) &&
          (expr.operator === ts.SyntaxKind.PlusPlusToken || expr.operator === ts.SyntaxKind.MinusMinusToken)
        ) {
          this.expressionEmitter.emitUpdateExpressionAsStatement(expr, ctx)
          return
        }
        this.expressionEmitter.emitExpression(expr, ctx)
        ctx.bytecode.emitOp(Opcode.OP_drop)
      }
      this.statementEmitter.emitForStatement(
        node as ts.ForStatement,
        context,
        (expr, ctx) => this.expressionEmitter.emitExpression(expr, ctx),
        (stmt, ctx) => this.dispatcher.dispatch(stmt, ctx),
        emitExpressionAsStatement,
      )
    })

    this.dispatcher.registerStatement(ts.SyntaxKind.ForInStatement, (node, context) => {
      this.statementEmitter.emitForInStatement(
        node as ts.ForInStatement,
        context,
        (expr, ctx) => this.expressionEmitter.emitExpression(expr, ctx),
        (stmt, ctx) => this.dispatcher.dispatch(stmt, ctx),
      )
    })

    this.dispatcher.registerStatement(ts.SyntaxKind.ForOfStatement, (node, context) => {
      this.statementEmitter.emitForOfStatement(
        node as ts.ForOfStatement,
        context,
        (expr, ctx) => this.expressionEmitter.emitExpression(expr, ctx),
        (stmt, ctx) => this.dispatcher.dispatch(stmt, ctx),
      )
    })

    this.dispatcher.registerStatement(ts.SyntaxKind.SwitchStatement, (node, context) => {
      this.statementEmitter.emitSwitchStatement(
        node as ts.SwitchStatement,
        context,
        (expr, ctx) => this.expressionEmitter.emitExpression(expr, ctx),
        (stmt, ctx) => this.dispatcher.dispatch(stmt, ctx),
      )
    })

    this.dispatcher.registerStatement(ts.SyntaxKind.LabeledStatement, (node, context) => {
      this.statementEmitter.emitLabeledStatement(
        node as ts.LabeledStatement,
        context,
        (stmt, ctx) => this.dispatcher.dispatch(stmt, ctx),
      )
    })

    this.dispatcher.registerStatement(ts.SyntaxKind.BreakStatement, (node, context) => {
      this.statementEmitter.emitBreakStatement(node as ts.BreakStatement, context)
    })

    this.dispatcher.registerStatement(ts.SyntaxKind.ContinueStatement, (node, context) => {
      this.statementEmitter.emitContinueStatement(node as ts.ContinueStatement, context)
    })

    const noop = () => {
      // 忽略仅类型声明或模块语法占位
    }

    this.dispatcher.registerStatement(ts.SyntaxKind.InterfaceDeclaration, noop)
    this.dispatcher.registerDeclaration(ts.SyntaxKind.InterfaceDeclaration, noop)
    this.dispatcher.registerStatement(ts.SyntaxKind.TypeAliasDeclaration, noop)
    this.dispatcher.registerDeclaration(ts.SyntaxKind.TypeAliasDeclaration, noop)
    this.dispatcher.registerStatement(ts.SyntaxKind.ExportDeclaration, noop)
    this.dispatcher.registerDeclaration(ts.SyntaxKind.ExportDeclaration, noop)
    this.dispatcher.registerStatement(ts.SyntaxKind.ExportAssignment, noop)
    this.dispatcher.registerDeclaration(ts.SyntaxKind.ExportAssignment, noop)
    this.dispatcher.registerStatement(ts.SyntaxKind.ImportDeclaration, noop)
    this.dispatcher.registerDeclaration(ts.SyntaxKind.ImportDeclaration, noop)
    this.dispatcher.registerStatement(ts.SyntaxKind.ImportEqualsDeclaration, noop)
    this.dispatcher.registerDeclaration(ts.SyntaxKind.ImportEqualsDeclaration, noop)

    const expressionKinds: ts.SyntaxKind[] = [
      ts.SyntaxKind.ParenthesizedExpression,
      ts.SyntaxKind.NumericLiteral,
      ts.SyntaxKind.BigIntLiteral,
      ts.SyntaxKind.StringLiteral,
      ts.SyntaxKind.NoSubstitutionTemplateLiteral,
      ts.SyntaxKind.TrueKeyword,
      ts.SyntaxKind.FalseKeyword,
      ts.SyntaxKind.NullKeyword,
      ts.SyntaxKind.ThisKeyword,
      ts.SyntaxKind.Identifier,
      ts.SyntaxKind.TypeOfExpression,
      ts.SyntaxKind.VoidExpression,
      ts.SyntaxKind.DeleteExpression,
      ts.SyntaxKind.PrefixUnaryExpression,
      ts.SyntaxKind.PostfixUnaryExpression,
      ts.SyntaxKind.BinaryExpression,
      ts.SyntaxKind.PropertyAccessExpression,
      ts.SyntaxKind.ElementAccessExpression,
      ts.SyntaxKind.CallExpression,
      ts.SyntaxKind.NewExpression,
      ts.SyntaxKind.TemplateExpression,
      ts.SyntaxKind.TaggedTemplateExpression,
      ts.SyntaxKind.ConditionalExpression,
      ts.SyntaxKind.MetaProperty,
      ts.SyntaxKind.AwaitExpression,
      ts.SyntaxKind.NonNullExpression,
      ts.SyntaxKind.AsExpression,
      ts.SyntaxKind.TypeAssertionExpression,
      ts.SyntaxKind.ArrayLiteralExpression,
      ts.SyntaxKind.ObjectLiteralExpression,
      ts.SyntaxKind.RegularExpressionLiteral,
      ts.SyntaxKind.FunctionExpression,
      ts.SyntaxKind.ArrowFunction,
      ts.SyntaxKind.YieldExpression,
      ts.SyntaxKind.ClassExpression,
    ]

    for (const kind of expressionKinds) {
      this.dispatcher.registerExpression(kind, (node, context) => {
        this.expressionEmitter.emitExpression(node as ts.Expression, context)
      })
    }
  }

  private hasTopLevelThis(sourceFile: ts.SourceFile): boolean {
    let found = false
    const visit = (node: ts.Node, inFunction: boolean) => {
      if (found) return
      if (!inFunction && node.kind === ts.SyntaxKind.ThisKeyword) {
        found = true
        return
      }
      const nextInFunction = inFunction || ts.isFunctionLike(node) || ts.isClassLike(node)
      ts.forEachChild(node, child => visit(child, nextInFunction))
    }
    visit(sourceFile, false)
    return found
  }

  private isStatementAssignmentOperator(kind: ts.SyntaxKind): boolean {
    switch (kind) {
      case ts.SyntaxKind.EqualsToken:
      case ts.SyntaxKind.PlusEqualsToken:
      case ts.SyntaxKind.MinusEqualsToken:
      case ts.SyntaxKind.AsteriskEqualsToken:
      case ts.SyntaxKind.SlashEqualsToken:
      case ts.SyntaxKind.PercentEqualsToken:
      case ts.SyntaxKind.AsteriskAsteriskEqualsToken:
      case ts.SyntaxKind.LessThanLessThanEqualsToken:
      case ts.SyntaxKind.GreaterThanGreaterThanEqualsToken:
      case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
      case ts.SyntaxKind.AmpersandEqualsToken:
      case ts.SyntaxKind.BarEqualsToken:
      case ts.SyntaxKind.CaretEqualsToken:
        return true
      default:
        return false
    }
  }

  private blockNeedsScope(block: ts.Block): boolean {
    for (const stmt of block.statements) {
      if (ts.isVariableStatement(stmt)) {
        const flags = stmt.declarationList.flags
        if (flags & (ts.NodeFlags.Let | ts.NodeFlags.Const)) {
          return true
        }
      }
      if (ts.isClassDeclaration(stmt) || ts.isFunctionDeclaration(stmt)) {
        return true
      }
    }
    return false
  }
}
