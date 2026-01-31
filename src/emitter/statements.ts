import ts from 'typescript'

import { Opcode } from '../env'
import type { EmitterContext } from './emitter'
import type { ExpressionEmitterFn } from './assignment'

export type StatementEmitterFn = (node: ts.Statement, context: EmitterContext) => void

/**
 * 语句发射器（基础控制流）。
 *
 * @source QuickJS/src/core/parser.c:6939-7078
 * @see js_parse_statement_or_decl
 */
export class StatementEmitter {
  emitIfStatement(
    node: ts.IfStatement,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
    emitStatement: StatementEmitterFn,
  ) {
    context.emitSourcePos(node)
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

  emitVariableStatement(
    node: ts.VariableStatement,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
  ) {
    context.emitSourcePos(node)
    for (const decl of node.declarationList.declarations) {
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
  }

  emitReturnStatement(
    node: ts.ReturnStatement,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
  ) {
    context.emitSourcePos(node)
    if (node.expression) {
      emitExpression(node.expression, context)
      context.bytecode.emitOp(Opcode.OP_return)
    } else {
      context.bytecode.emitOp(Opcode.OP_return_undef)
    }
  }

  emitThrowStatement(
    node: ts.ThrowStatement,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
  ) {
    context.emitSourcePos(node)
    emitExpression(node.expression, context)
    context.bytecode.emitOp(Opcode.OP_throw)
  }
}
