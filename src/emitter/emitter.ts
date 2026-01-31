import ts from 'typescript'

import { TempOpcode } from '../env'
import type { JSAtom } from '../env'

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
  private liveCode = true
  private lineColCache

  constructor(options: EmitterContextOptions) {
    this.sourceFile = options.sourceFile
    this.inlineCache = options.inlineCache ?? new InlineCacheManager()
    this.constantPool = options.constantPool ?? new ConstantPoolManager()
    this.scopes = new ScopeManager()
    this.atomTable = options.atomTable
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

  /**
   * 获取行列缓存（用于测试或调试）。
   *
   * @source QuickJS/src/core/parser.c:151-193
   * @see get_line_col_cached
   */
  getLineColCache() {
    return this.lineColCache
  }
}

export interface BytecodeCompilerOptions {
  atomTable?: AtomTable
  inlineCache?: InlineCacheManager
  constantPool?: ConstantPoolManager
  bytecode?: BytecodeBuffer
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
    const context = new EmitterContext({
      sourceFile,
      atomTable: this.options.atomTable,
      inlineCache: this.options.inlineCache,
      constantPool: this.options.constantPool,
      bytecode: this.options.bytecode,
    })

    for (const stmt of sourceFile.statements) {
      this.dispatcher.dispatch(stmt, context)
    }
    return context.bytecode.bytecode
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
      const scope = context.pushScope()
      for (const stmt of block.statements) {
        this.dispatcher.dispatch(stmt, context)
      }
      context.popScope()
    })

    this.dispatcher.registerStatement(ts.SyntaxKind.EmptyStatement, () => {
      // 空语句不产生字节码
    })

    this.dispatcher.registerStatement(ts.SyntaxKind.ExpressionStatement, (node, context) => {
      const stmt = node as ts.ExpressionStatement
      context.emitSourcePos(stmt)
      this.dispatcher.dispatch(stmt.expression, context)
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
        node as ts.VariableStatement,
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
      ts.SyntaxKind.PrefixUnaryExpression,
      ts.SyntaxKind.BinaryExpression,
      ts.SyntaxKind.PropertyAccessExpression,
      ts.SyntaxKind.ElementAccessExpression,
      ts.SyntaxKind.CallExpression,
      ts.SyntaxKind.NewExpression,
      ts.SyntaxKind.TemplateExpression,
      ts.SyntaxKind.ConditionalExpression,
      ts.SyntaxKind.MetaProperty,
      ts.SyntaxKind.AwaitExpression,
      ts.SyntaxKind.ArrayLiteralExpression,
      ts.SyntaxKind.ObjectLiteralExpression,
    ]

    for (const kind of expressionKinds) {
      this.dispatcher.registerExpression(kind, (node, context) => {
        this.expressionEmitter.emitExpression(node as ts.Expression, context)
      })
    }
  }
}
