import ts from 'typescript'

import { FOR_OF_NEXT_OPERAND_DEFAULT, JSAtom, JSVarKindEnum, Opcode } from '../env'
import type { EmitterContext } from './emitter'
import type { ExpressionEmitterFn } from './assignment'
import { DestructuringEmitter } from './destructuring'
import { FunctionEmitter } from './functions'
import { ClassEmitter } from './classes'
import { emitAsyncGeneratorReturn } from './async'

export type StatementEmitterFn = (node: ts.Statement, context: EmitterContext) => void

/**
 * 语句发射器（基础控制流）。
 *
 * @source QuickJS/src/core/parser.c:6939-7078
 * @see js_parse_statement_or_decl
 */
export class StatementEmitter {
  private loopStack: Array<{ breakLabel: number; continueLabel?: number; label?: string }> = []
  private labelStack: Array<{ label: string; breakLabel: number; continueLabel?: number }> = []
  private pendingLabel?: string
  private destructuringEmitter = new DestructuringEmitter()
  private functionEmitter = new FunctionEmitter()
  private classEmitter = new ClassEmitter()

  private pushLoop(breakLabel: number, continueLabel?: number) {
    const label = this.pendingLabel
    this.pendingLabel = undefined
    this.loopStack.push({ breakLabel, continueLabel, label })
    if (label) {
      this.labelStack.push({ label, breakLabel, continueLabel })
    }
  }

  private popLoop() {
    const loop = this.loopStack.pop()
    if (loop?.label) {
      this.labelStack.pop()
    }
  }

  private currentLoop() {
    return this.loopStack[this.loopStack.length - 1]
  }

  private findLabel(name: string) {
    for (let i = this.labelStack.length - 1; i >= 0; i -= 1) {
      const entry = this.labelStack[i]
      if (entry.label === name) return entry
    }
    return undefined
  }

  emitLabeledStatement(node: ts.LabeledStatement, context: EmitterContext, emitStatement: StatementEmitterFn) {
    context.emitSourcePos(node)
    const label = node.label.text

    if (
      ts.isForStatement(node.statement) ||
      ts.isForInStatement(node.statement) ||
      ts.isForOfStatement(node.statement) ||
      ts.isWhileStatement(node.statement) ||
      ts.isDoStatement(node.statement) ||
      ts.isSwitchStatement(node.statement)
    ) {
      this.pendingLabel = label
      emitStatement(node.statement, context)
      if (this.pendingLabel === label) {
        this.pendingLabel = undefined
      }
      return
    }

    const endLabel = context.labels.newLabel()
    this.labelStack.push({ label, breakLabel: endLabel })
    emitStatement(node.statement, context)
    this.labelStack.pop()
    context.labels.emitLabel(endLabel)
  }

  /**
   * @source QuickJS/src/core/parser.c:7010-7064
   * @see js_parse_statement_or_decl
   */
  emitIfStatement(
    node: ts.IfStatement,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
    emitStatement: StatementEmitterFn,
  ) {
    context.emitSourcePos(node)

    if (!node.elseStatement) {
      const loop = this.currentLoop()
      if (loop && ts.isBreakStatement(node.thenStatement)) {
        emitExpression(node.expression, context)
        context.labels.emitGoto(Opcode.OP_if_true, loop.breakLabel)
        return
      }
      if (loop?.continueLabel !== undefined && ts.isContinueStatement(node.thenStatement)) {
        emitExpression(node.expression, context)
        context.labels.emitGoto(Opcode.OP_if_true, loop.continueLabel)
        return
      }
    }

    emitExpression(node.expression, context)
    const falseLabel = context.labels.emitGoto(Opcode.OP_if_false, -1)
    emitStatement(node.thenStatement, context)
    if (node.elseStatement) {
      const endLabel = context.labels.emitGoto(Opcode.OP_goto, -1)
      context.labels.emitLabel(falseLabel)
      emitStatement(node.elseStatement, context)
      context.labels.emitLabel(endLabel)
      return
    }
    context.labels.emitLabel(falseLabel)
  }

  /**
   * @source QuickJS/src/core/parser.c:6956-6988
   * @see js_parse_statement_or_decl
   */
  emitVariableStatement(
    node: ts.VariableStatement,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
  ) {
    context.emitSourcePos(node)
    const isLexical = Boolean(node.declarationList.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const))
    const isConst = Boolean(node.declarationList.flags & ts.NodeFlags.Const)
    for (const decl of node.declarationList.declarations) {
      const localIdx = (() => {
        if (!context.inFunction || !isLexical || !ts.isIdentifier(decl.name)) return undefined
        const atom = context.getAtom(decl.name.text)
        const scopeLevel = context.scopes.scopeLevel
        if (scopeLevel < 0) return undefined
        const existing = context.scopes.findVarInScope(atom, scopeLevel)
        if (existing >= 0) return existing
        const idx = context.scopes.addScopeVar(atom, JSVarKindEnum.JS_VAR_NORMAL)
        const vd = context.scopes.vars[idx]
        vd.isLexical = true
        vd.isConst = isConst
        return idx
      })()

      if (localIdx !== undefined && (!decl.initializer || ts.isIdentifier(decl.name))) {
        context.bytecode.emitOp(Opcode.OP_set_loc_uninitialized)
        context.bytecode.emitU16(localIdx)
      }

      if (decl.initializer && (ts.isObjectBindingPattern(decl.name) || ts.isArrayBindingPattern(decl.name))) {
        this.destructuringEmitter.emitBindingPattern(decl.name, decl.initializer, context, emitExpression)
        continue
      }
      if (!ts.isIdentifier(decl.name)) {
        throw new Error(`未支持的变量声明结构: ${ts.SyntaxKind[decl.name.kind]}`)
      }
      const atom = context.getAtom(decl.name.text)
      if (decl.initializer) {
        emitExpression(decl.initializer, context)
        if (ts.isFunctionExpression(decl.initializer) || ts.isArrowFunction(decl.initializer)) {
          context.bytecode.emitOp(Opcode.OP_set_name)
          context.bytecode.emitAtom(atom)
        }
        if (localIdx !== undefined) {
          context.bytecode.emitOp(Opcode.OP_put_loc)
          context.bytecode.emitU16(localIdx)
        } else if (isLexical) {
          context.bytecode.emitOp(Opcode.OP_put_var_init)
          context.bytecode.emitAtom(atom)
        } else {
          context.bytecode.emitOp(Opcode.OP_put_var)
          context.bytecode.emitAtom(atom)
        }
      } else if (localIdx !== undefined) {
        context.bytecode.emitOp(Opcode.OP_set_loc_uninitialized)
        context.bytecode.emitU16(localIdx)
      } else if (isLexical) {
        context.bytecode.emitOp(Opcode.OP_undefined)
        context.bytecode.emitOp(Opcode.OP_put_var_init)
        context.bytecode.emitAtom(atom)
      }
    }
  }

  /**
   * @source QuickJS/src/core/parser.c:7629-7670
   * @see js_parse_statement_or_decl
   */
  emitFunctionDeclaration(node: ts.FunctionDeclaration, context: EmitterContext) {
    context.emitSourcePos(node)
    this.functionEmitter.emitFunctionDeclaration(node, context)
  }

  /**
   * @source QuickJS/src/core/parser.c:7674-7686
   * @see js_parse_statement_or_decl
   */
  emitClassDeclaration(
    node: ts.ClassDeclaration,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
  ) {
    this.classEmitter.emitClassDeclaration(node, context, emitExpression)
  }

  /**
   * @source QuickJS/src/core/parser.c:6898-6932
   * @see js_parse_statement_or_decl
   */
  emitReturnStatement(
    node: ts.ReturnStatement,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
  ) {
    context.emitSourcePos(node)
    if (node.expression) {
      emitExpression(node.expression, context)
      if (context.inAsync && context.inGenerator) {
        emitAsyncGeneratorReturn(context, true)
      } else {
        context.bytecode.emitOp((context.inAsync || context.inGenerator) ? Opcode.OP_return_async : Opcode.OP_return)
      }
    } else {
      if (context.inAsync && context.inGenerator) {
        emitAsyncGeneratorReturn(context, false)
      } else if (context.inAsync || context.inGenerator) {
        context.bytecode.emitOp(Opcode.OP_undefined)
        context.bytecode.emitOp(Opcode.OP_return_async)
      } else {
        context.bytecode.emitOp(Opcode.OP_return_undef)
      }
    }
  }

  /**
   * @source QuickJS/src/core/parser.c:6934-6955
   * @see js_parse_statement_or_decl
   */
  emitThrowStatement(
    node: ts.ThrowStatement,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
  ) {
    context.emitSourcePos(node)
    emitExpression(node.expression, context)
    context.bytecode.emitOp(Opcode.OP_throw)
  }

  /**
   * @source QuickJS/src/core/parser.c:7345-7690
   * @see js_parse_statement_or_decl
   */
  emitTryStatement(
    node: ts.TryStatement,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
    emitStatement: StatementEmitterFn,
  ) {
    context.emitSourcePos(node)

    const catchLabel = context.labels.newLabel()
    const endLabel = context.labels.newLabel()
    const hasCatch = Boolean(node.catchClause)
    const hasFinally = Boolean(node.finallyBlock)
    const finallyLabel = hasFinally ? context.labels.newLabel() : -1

    context.bytecode.emitOp(Opcode.OP_catch)
    context.bytecode.emitU32(catchLabel)

    for (const stmt of node.tryBlock.statements) {
      emitStatement(stmt, context)
    }

    if (hasFinally && finallyLabel >= 0) {
      context.labels.emitGoto(Opcode.OP_gosub, finallyLabel)
    }

    context.bytecode.emitOp(Opcode.OP_drop)
    context.labels.emitGoto(Opcode.OP_goto, endLabel)

    context.labels.emitLabel(catchLabel)

    if (hasCatch && node.catchClause) {
      const innerCatchLabel = context.labels.newLabel()
      const decl = node.catchClause.variableDeclaration
      if (decl && ts.isIdentifier(decl.name)) {
        const atom = context.getAtom(decl.name.text)
        context.bytecode.emitOp(Opcode.OP_put_var)
        context.bytecode.emitAtom(atom)
      } else {
        context.bytecode.emitOp(Opcode.OP_drop)
      }
      context.bytecode.emitOp(Opcode.OP_catch)
      context.bytecode.emitU32(innerCatchLabel)
      for (const stmt of node.catchClause.block.statements) {
        emitStatement(stmt, context)
      }
      context.bytecode.emitOp(Opcode.OP_drop)
      if (hasFinally && finallyLabel >= 0) {
        context.labels.emitGoto(Opcode.OP_gosub, finallyLabel)
      }
      context.labels.emitGoto(Opcode.OP_goto, endLabel)

      context.labels.emitLabel(innerCatchLabel)
      context.bytecode.emitOp(Opcode.OP_throw)
    }

    if (!hasCatch && hasFinally && finallyLabel >= 0) {
      context.labels.emitGoto(Opcode.OP_gosub, finallyLabel)
      context.bytecode.emitOp(Opcode.OP_throw)
    }

    if (hasFinally && finallyLabel >= 0) {
      context.labels.emitLabel(finallyLabel)
      for (const stmt of node.finallyBlock?.statements ?? []) {
        emitStatement(stmt, context)
      }
      context.bytecode.emitOp(Opcode.OP_ret)
    }

    context.labels.emitLabel(endLabel)
  }

  /**
   * @source QuickJS/src/core/parser.c:7210-7339
   * @see js_parse_statement_or_decl
   */
  emitSwitchStatement(
    node: ts.SwitchStatement,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
    emitStatement: StatementEmitterFn,
  ) {
    context.emitSourcePos(node)
    emitExpression(node.expression, context)

    const breakLabel = context.labels.newLabel()
    const defaultClause = node.caseBlock.clauses.find(clause => ts.isDefaultClause(clause))

    this.pushLoop(breakLabel)

    for (const clause of node.caseBlock.clauses) {
      if (!ts.isCaseClause(clause)) continue
      const nextLabel = context.labels.newLabel()
      context.bytecode.emitOp(Opcode.OP_dup)
      emitExpression(clause.expression, context)
      context.bytecode.emitOp(Opcode.OP_strict_eq)
      context.labels.emitGoto(Opcode.OP_if_false, nextLabel)
      for (const stmt of clause.statements) {
        emitStatement(stmt, context)
      }
      context.labels.emitLabel(nextLabel)
    }

    if (defaultClause) {
      for (const stmt of defaultClause.statements) {
        emitStatement(stmt, context)
      }
    }

    this.popLoop()

    context.labels.emitLabel(breakLabel)
    context.bytecode.emitOp(Opcode.OP_drop)
  }

  /**
   * @source QuickJS/src/core/parser.c:6691-6840
   * @source QuickJS/src/core/parser.c:6840-6935
   * @see js_parse_for_in_of
   */
  emitForInStatement(
    node: ts.ForInStatement,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
    emitStatement: StatementEmitterFn,
  ) {
    context.emitSourcePos(node)
    emitExpression(node.expression, context)
    context.bytecode.emitOp(Opcode.OP_for_in_start)

    const bodyLabel = context.labels.newLabel()
    const testLabel = context.labels.newLabel()
    const breakLabel = context.labels.newLabel()

    context.labels.emitGoto(Opcode.OP_goto, testLabel)
    context.labels.emitLabel(bodyLabel)

    this.emitForInOfTarget(node.initializer, context, emitExpression)

    this.pushLoop(breakLabel, testLabel)
    emitStatement(node.statement, context)
    this.popLoop()

    context.labels.emitLabel(testLabel)
    context.bytecode.emitOp(Opcode.OP_for_in_next)
    context.labels.emitGoto(Opcode.OP_if_false, bodyLabel)

    context.labels.emitLabel(breakLabel)
    context.bytecode.emitOp(Opcode.OP_drop)
    context.bytecode.emitOp(Opcode.OP_drop)
  }

  /**
   * @source QuickJS/src/core/parser.c:6691-6840
   * @source QuickJS/src/core/parser.c:6840-6935
   * @see js_parse_for_in_of
   */
  emitForOfStatement(
    node: ts.ForOfStatement,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
    emitStatement: StatementEmitterFn,
  ) {
    context.emitSourcePos(node)
    const target = this.resolveForInOfTarget(node.initializer, context)
    if (target?.needsInit && target.kind === 'loc' && target.localIdx !== undefined) {
      context.bytecode.emitOp(Opcode.OP_set_loc_uninitialized)
      context.bytecode.emitU16(target.localIdx)
    }
    emitExpression(node.expression, context)
    const isAwait = Boolean(node.awaitModifier)
    context.bytecode.emitOp(isAwait ? Opcode.OP_for_await_of_start : Opcode.OP_for_of_start)

    const bodyLabel = context.labels.newLabel()
    const testLabel = context.labels.newLabel()
    const breakLabel = context.labels.newLabel()

    context.labels.emitGoto(Opcode.OP_goto, testLabel)
    context.labels.emitLabel(bodyLabel)

    this.emitForInOfTarget(node.initializer, context, emitExpression, target)

    context.pushIterator()
    this.pushLoop(breakLabel, testLabel)
    emitStatement(node.statement, context)
    this.popLoop()
    context.popIterator()

    context.labels.emitLabel(testLabel)
    if (isAwait) {
      context.bytecode.emitOp(Opcode.OP_for_await_of_next)
      context.bytecode.emitOp(Opcode.OP_await)
      context.bytecode.emitOp(Opcode.OP_iterator_get_value_done)
      context.labels.emitGoto(Opcode.OP_if_false, bodyLabel)
    } else {
      context.bytecode.emitOp(Opcode.OP_for_of_next)
      context.bytecode.emitU8(FOR_OF_NEXT_OPERAND_DEFAULT)
      context.labels.emitGoto(Opcode.OP_if_false, bodyLabel)
    }

    context.labels.emitLabel(breakLabel)
    context.bytecode.emitOp(Opcode.OP_drop)
    context.bytecode.emitOp(Opcode.OP_iterator_close)
  }

  /**
   * @source QuickJS/src/core/parser.c:7700-7715
   * @see js_parse_statement_or_decl
   */
  emitDebuggerStatement(node: ts.DebuggerStatement, context: EmitterContext) {
    context.emitSourcePos(node)
    context.bytecode.emitOp(Opcode.OP_debugger)
  }

  /**
   * @source QuickJS/src/core/parser.c:7716-7753
   * @see js_parse_statement_or_decl
   */
  emitWithStatement(
    node: ts.WithStatement,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
    emitStatement: StatementEmitterFn,
  ) {
    context.emitSourcePos(node)
    emitExpression(node.expression, context)
    context.pushScope()
    const withIdx = context.scopes.addScopeVar(JSAtom.JS_ATOM__with_, JSVarKindEnum.JS_VAR_NORMAL)
    context.bytecode.emitOp(Opcode.OP_set_loc_uninitialized)
    context.bytecode.emitU16(withIdx)
    context.bytecode.emitOp(Opcode.OP_to_object)
    context.bytecode.emitOp(Opcode.OP_put_loc)
    context.bytecode.emitU16(withIdx)

    context.bytecode.emitOp(Opcode.OP_undefined)
    context.bytecode.emitOp(Opcode.OP_put_loc)
    context.bytecode.emitU16(0)

    emitStatement(node.statement, context)
    context.popScope()
  }

  /**
   * @source QuickJS/src/core/parser.c:7065-7095
   * @see js_parse_statement_or_decl
   */
  emitWhileStatement(
    node: ts.WhileStatement,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
    emitStatement: StatementEmitterFn,
  ) {
    context.emitSourcePos(node)
    const startLabel = context.labels.newLabel()
    const endLabel = context.labels.newLabel()

    context.labels.emitLabel(startLabel)
    emitExpression(node.expression, context)
    context.labels.emitGoto(Opcode.OP_if_false, endLabel)

    this.pushLoop(endLabel, startLabel)
    emitStatement(node.statement, context)
    this.popLoop()

    context.labels.emitGoto(Opcode.OP_goto, startLabel)
    context.labels.emitLabel(endLabel)
  }

  /**
   * @source QuickJS/src/core/parser.c:7096-7124
   * @see js_parse_statement_or_decl
   */
  emitDoWhileStatement(
    node: ts.DoStatement,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
    emitStatement: StatementEmitterFn,
  ) {
    context.emitSourcePos(node)
    const startLabel = context.labels.newLabel()
    const continueLabel = context.labels.newLabel()
    const endLabel = context.labels.newLabel()

    context.labels.emitLabel(startLabel)
    this.pushLoop(endLabel, continueLabel)
    emitStatement(node.statement, context)
    this.popLoop()

    context.labels.emitLabel(continueLabel)
    emitExpression(node.expression, context)
    context.labels.emitGoto(Opcode.OP_if_true, startLabel)
    context.labels.emitLabel(endLabel)
  }

  /**
   * @source QuickJS/src/core/parser.c:7125-7205
   * @see js_parse_statement_or_decl
   */
  emitForStatement(
    node: ts.ForStatement,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
    emitStatement: StatementEmitterFn,
  ) {
    context.emitSourcePos(node)

    if (node.initializer) {
      if (ts.isVariableDeclarationList(node.initializer)) {
        for (const decl of node.initializer.declarations) {
          if (!ts.isIdentifier(decl.name)) {
            throw new Error(`未支持的变量声明结构: ${ts.SyntaxKind[decl.name.kind]}`)
          }
          const atom = context.getAtom(decl.name.text)
          if (decl.initializer) {
            emitExpression(decl.initializer, context)
            context.bytecode.emitOp(Opcode.OP_put_var)
            context.bytecode.emitAtom(atom)
          }
        }
      } else {
        emitExpression(node.initializer, context)
      }
    }

    const testLabel = context.labels.newLabel()
    const updateLabel = context.labels.newLabel()
    const endLabel = context.labels.newLabel()

    context.labels.emitLabel(testLabel)
    if (node.condition) {
      emitExpression(node.condition, context)
      context.labels.emitGoto(Opcode.OP_if_false, endLabel)
    }

    this.pushLoop(endLabel, updateLabel)
    emitStatement(node.statement, context)
    this.popLoop()

    context.labels.emitLabel(updateLabel)
    if (node.incrementor) {
      emitExpression(node.incrementor, context)
      context.bytecode.emitOp(Opcode.OP_drop)
    }
    context.labels.emitGoto(Opcode.OP_goto, testLabel)
    context.labels.emitLabel(endLabel)
  }

  /**
   * @source QuickJS/src/core/parser.c:7190-7210
   * @see js_parse_statement_or_decl
   */
  emitBreakStatement(node: ts.BreakStatement, context: EmitterContext) {
    context.emitSourcePos(node)
    if (node.label) {
      const entry = this.findLabel(node.label.text)
      if (!entry) {
        throw new Error(`未知的 break 标签: ${node.label.text}`)
      }
      context.labels.emitGoto(Opcode.OP_goto, entry.breakLabel)
      return
    }
    const loop = this.currentLoop()
    if (!loop) {
      throw new Error('break 必须位于循环语句内部')
    }
    context.labels.emitGoto(Opcode.OP_goto, loop.breakLabel)
  }

  /**
   * @source QuickJS/src/core/parser.c:7190-7210
   * @see js_parse_statement_or_decl
   */
  emitContinueStatement(node: ts.ContinueStatement, context: EmitterContext) {
    context.emitSourcePos(node)
    if (node.label) {
      const entry = this.findLabel(node.label.text)
      if (!entry || entry.continueLabel === undefined) {
        throw new Error(`未知的 continue 标签: ${node.label.text}`)
      }
      context.labels.emitGoto(Opcode.OP_goto, entry.continueLabel)
      return
    }
    const loop = this.currentLoop()
    if (!loop || loop.continueLabel === undefined) {
      throw new Error('continue 必须位于循环语句内部')
    }
    context.labels.emitGoto(Opcode.OP_goto, loop.continueLabel)
  }

  private emitForInOfTarget(
    initializer: ts.ForInitializer,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
    target?: { kind: 'loc' | 'var' | 'pattern'; localIdx?: number; atom?: number; pattern?: ts.ObjectBindingPattern | ts.ArrayBindingPattern },
  ) {
    if (target?.kind === 'loc' && target.localIdx !== undefined) {
      context.bytecode.emitOp(Opcode.OP_put_loc)
      context.bytecode.emitU16(target.localIdx)
      return
    }
    if (target?.kind === 'var' && target.atom !== undefined) {
      context.bytecode.emitOp(Opcode.OP_put_var)
      context.bytecode.emitAtom(target.atom)
      return
    }
    if (target?.kind === 'pattern' && target.pattern) {
      this.destructuringEmitter.emitBindingPatternFromValue(target.pattern, context, emitExpression)
      return
    }

    if (ts.isVariableDeclarationList(initializer)) {
      const decl = initializer.declarations[0]
      if (!decl) {
        throw new Error('未支持的 for-in/of 变量声明: 未知')
      }
      if (ts.isIdentifier(decl.name)) {
        const atom = context.getAtom(decl.name.text)
        context.bytecode.emitOp(Opcode.OP_put_var)
        context.bytecode.emitAtom(atom)
        return
      }
      if (ts.isObjectBindingPattern(decl.name) || ts.isArrayBindingPattern(decl.name)) {
        this.destructuringEmitter.emitBindingPatternFromValue(decl.name, context, emitExpression)
        return
      }
      const declKind = (decl.name as ts.Node).kind
      throw new Error(`未支持的 for-in/of 变量声明: ${ts.SyntaxKind[declKind]}`)
    }

    if (ts.isIdentifier(initializer)) {
      const atom = context.getAtom(initializer.text)
      context.bytecode.emitOp(Opcode.OP_put_var)
      context.bytecode.emitAtom(atom)
      return
    }

    throw new Error(`未支持的 for-in/of 赋值目标: ${ts.SyntaxKind[initializer.kind]}`)
  }

  private resolveForInOfTarget(initializer: ts.ForInitializer, context: EmitterContext) {
    if (!ts.isVariableDeclarationList(initializer)) return undefined
    const decl = initializer.declarations[0]
    if (!decl) {
      throw new Error('未支持的 for-in/of 变量声明: 未知')
    }
    if (ts.isObjectBindingPattern(decl.name) || ts.isArrayBindingPattern(decl.name)) {
      return { kind: 'pattern' as const, pattern: decl.name }
    }
    if (!ts.isIdentifier(decl.name)) {
      const declKind = (decl.name as ts.Node).kind
      throw new Error(`未支持的 for-in/of 变量声明: ${ts.SyntaxKind[declKind]}`)
    }

    const atom = context.getAtom(decl.name.text)
    const isLexical = Boolean(initializer.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const))
    const isConst = Boolean(initializer.flags & ts.NodeFlags.Const)
    if (isLexical && context.scopes.scopeLevel >= 0) {
      const scopeLevel = context.scopes.scopeLevel
      const existing = context.scopes.findVarInScope(atom, scopeLevel)
      const localIdx = existing >= 0 ? existing : context.scopes.addScopeVar(atom, JSVarKindEnum.JS_VAR_NORMAL)
      const vd = context.scopes.vars[localIdx]
      vd.isLexical = true
      vd.isConst = isConst
      return { kind: 'loc' as const, localIdx, needsInit: existing < 0 }
    }

    return { kind: 'var' as const, atom }
  }
}
