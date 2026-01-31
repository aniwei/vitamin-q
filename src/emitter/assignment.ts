import ts from 'typescript'

import { Opcode } from '../env'
import type { EmitterContext } from './emitter'

export type ExpressionEmitterFn = (node: ts.Expression, context: EmitterContext) => void

/**
 * 赋值表达式发射器。
 *
 * @source QuickJS/src/core/parser.c:6004
 * @see js_parse_assign_expr2
 */
export class AssignmentEmitter {
  emitAssignment(node: ts.BinaryExpression, context: EmitterContext, emitExpression: ExpressionEmitterFn) {
    const opKind = node.operatorToken.kind
    if (opKind === ts.SyntaxKind.EqualsToken) {
      this.emitSimpleAssignment(node.left, node.right, context, emitExpression)
      return
    }

    const logicalKind = this.getLogicalAssignmentKind(opKind)
    if (logicalKind) {
      this.emitLogicalAssignment(node.left, node.right, logicalKind, context, emitExpression)
      return
    }

    const compoundOpcode = this.getCompoundOpcode(opKind)
    if (!compoundOpcode) {
      throw new Error(`未支持的赋值运算符: ${ts.SyntaxKind[opKind]}`)
    }

    this.emitCompoundAssignment(node.left, node.right, compoundOpcode, context, emitExpression)
  }

  private emitSimpleAssignment(
    left: ts.Expression,
    right: ts.Expression,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
  ) {
    if (ts.isIdentifier(left)) {
      emitExpression(right, context)
      context.bytecode.emitOp(Opcode.OP_dup)
      context.bytecode.emitOp(Opcode.OP_put_var)
      context.bytecode.emitAtom(context.getAtom(left.text))
      return
    }

    if (ts.isPropertyAccessExpression(left)) {
      emitExpression(left.expression, context)
      emitExpression(right, context)
      context.bytecode.emitOp(Opcode.OP_insert2)
      context.bytecode.emitOp(Opcode.OP_put_field)
      context.bytecode.emitAtom(context.getAtom(left.name.text))
      return
    }

    if (ts.isElementAccessExpression(left)) {
      emitExpression(left.expression, context)
      emitExpression(left.argumentExpression, context)
      emitExpression(right, context)
      context.bytecode.emitOp(Opcode.OP_insert3)
      context.bytecode.emitOp(Opcode.OP_put_array_el)
      return
    }

    throw new Error(`未支持的赋值左值: ${ts.SyntaxKind[left.kind]}`)
  }

  private emitCompoundAssignment(
    left: ts.Expression,
    right: ts.Expression,
    opcode: Opcode,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
  ) {
    if (ts.isIdentifier(left)) {
      context.bytecode.emitOp(Opcode.OP_get_var)
      context.bytecode.emitAtom(context.getAtom(left.text))
      emitExpression(right, context)
      context.bytecode.emitOp(opcode)
      context.bytecode.emitOp(Opcode.OP_dup)
      context.bytecode.emitOp(Opcode.OP_put_var)
      context.bytecode.emitAtom(context.getAtom(left.text))
      return
    }

    if (ts.isPropertyAccessExpression(left)) {
      emitExpression(left.expression, context)
      context.bytecode.emitOp(Opcode.OP_get_field2)
      context.bytecode.emitAtom(context.getAtom(left.name.text))
      emitExpression(right, context)
      context.bytecode.emitOp(opcode)
      context.bytecode.emitOp(Opcode.OP_insert2)
      context.bytecode.emitOp(Opcode.OP_put_field)
      context.bytecode.emitAtom(context.getAtom(left.name.text))
      return
    }

    if (ts.isElementAccessExpression(left)) {
      emitExpression(left.expression, context)
      emitExpression(left.argumentExpression, context)
      context.bytecode.emitOp(Opcode.OP_get_array_el3)
      emitExpression(right, context)
      context.bytecode.emitOp(opcode)
      context.bytecode.emitOp(Opcode.OP_insert3)
      context.bytecode.emitOp(Opcode.OP_put_array_el)
      return
    }

    throw new Error(`未支持的赋值左值: ${ts.SyntaxKind[left.kind]}`)
  }

  private emitLogicalAssignment(
    left: ts.Expression,
    right: ts.Expression,
    logicalKind: '&&' | '||' | '??',
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
  ) {
    const endLabel = context.labels.newLabel()

    if (ts.isIdentifier(left)) {
      const atom = context.getAtom(left.text)
      context.bytecode.emitOp(Opcode.OP_get_var)
      context.bytecode.emitAtom(atom)
      context.bytecode.emitOp(Opcode.OP_dup)

      if (logicalKind === '&&') {
        const skipLabel = context.labels.emitGoto(Opcode.OP_if_false, -1)
        context.bytecode.emitOp(Opcode.OP_drop)
        emitExpression(right, context)
        context.bytecode.emitOp(Opcode.OP_dup)
        context.bytecode.emitOp(Opcode.OP_put_var)
        context.bytecode.emitAtom(atom)
        context.labels.emitGoto(Opcode.OP_goto, endLabel)
        context.labels.emitLabel(skipLabel)
        context.labels.emitLabel(endLabel)
        return
      }

      if (logicalKind === '||') {
        const skipLabel = context.labels.emitGoto(Opcode.OP_if_true, -1)
        context.bytecode.emitOp(Opcode.OP_drop)
        emitExpression(right, context)
        context.bytecode.emitOp(Opcode.OP_dup)
        context.bytecode.emitOp(Opcode.OP_put_var)
        context.bytecode.emitAtom(atom)
        context.labels.emitGoto(Opcode.OP_goto, endLabel)
        context.labels.emitLabel(skipLabel)
        context.labels.emitLabel(endLabel)
        return
      }

      context.bytecode.emitOp(Opcode.OP_is_undefined_or_null)
      const assignLabel = context.labels.emitGoto(Opcode.OP_if_true, -1)
      context.labels.emitGoto(Opcode.OP_goto, endLabel)
      context.labels.emitLabel(assignLabel)
      context.bytecode.emitOp(Opcode.OP_drop)
      emitExpression(right, context)
      context.bytecode.emitOp(Opcode.OP_dup)
      context.bytecode.emitOp(Opcode.OP_put_var)
      context.bytecode.emitAtom(atom)
      context.labels.emitLabel(endLabel)
      return
    }

    if (ts.isPropertyAccessExpression(left)) {
      emitExpression(left.expression, context)
      const atom = context.getAtom(left.name.text)
      context.bytecode.emitOp(Opcode.OP_get_field2)
      context.bytecode.emitAtom(atom)
      context.bytecode.emitOp(Opcode.OP_dup)

      if (logicalKind === '&&') {
        const skipLabel = context.labels.emitGoto(Opcode.OP_if_false, -1)
        context.bytecode.emitOp(Opcode.OP_drop)
        context.bytecode.emitOp(Opcode.OP_drop)
        emitExpression(right, context)
        context.bytecode.emitOp(Opcode.OP_insert2)
        context.bytecode.emitOp(Opcode.OP_put_field)
        context.bytecode.emitAtom(atom)
        context.labels.emitGoto(Opcode.OP_goto, endLabel)
        context.labels.emitLabel(skipLabel)
        context.bytecode.emitOp(Opcode.OP_swap)
        context.bytecode.emitOp(Opcode.OP_drop)
        context.labels.emitLabel(endLabel)
        return
      }

      if (logicalKind === '||') {
        const skipLabel = context.labels.emitGoto(Opcode.OP_if_true, -1)
        context.bytecode.emitOp(Opcode.OP_drop)
        context.bytecode.emitOp(Opcode.OP_drop)
        emitExpression(right, context)
        context.bytecode.emitOp(Opcode.OP_insert2)
        context.bytecode.emitOp(Opcode.OP_put_field)
        context.bytecode.emitAtom(atom)
        context.labels.emitGoto(Opcode.OP_goto, endLabel)
        context.labels.emitLabel(skipLabel)
        context.bytecode.emitOp(Opcode.OP_swap)
        context.bytecode.emitOp(Opcode.OP_drop)
        context.labels.emitLabel(endLabel)
        return
      }

      context.bytecode.emitOp(Opcode.OP_is_undefined_or_null)
      const assignLabel = context.labels.emitGoto(Opcode.OP_if_true, -1)
      context.bytecode.emitOp(Opcode.OP_swap)
      context.bytecode.emitOp(Opcode.OP_drop)
      context.labels.emitGoto(Opcode.OP_goto, endLabel)
      context.labels.emitLabel(assignLabel)
      context.bytecode.emitOp(Opcode.OP_drop)
      emitExpression(right, context)
      context.bytecode.emitOp(Opcode.OP_insert2)
      context.bytecode.emitOp(Opcode.OP_put_field)
      context.bytecode.emitAtom(atom)
      context.labels.emitLabel(endLabel)
      return
    }

    if (ts.isElementAccessExpression(left)) {
      emitExpression(left.expression, context)
      emitExpression(left.argumentExpression, context)
      context.bytecode.emitOp(Opcode.OP_get_array_el3)
      context.bytecode.emitOp(Opcode.OP_dup)

      if (logicalKind === '&&') {
        const skipLabel = context.labels.emitGoto(Opcode.OP_if_false, -1)
        context.bytecode.emitOp(Opcode.OP_drop)
        context.bytecode.emitOp(Opcode.OP_drop)
        emitExpression(right, context)
        context.bytecode.emitOp(Opcode.OP_insert3)
        context.bytecode.emitOp(Opcode.OP_put_array_el)
        context.labels.emitGoto(Opcode.OP_goto, endLabel)
        context.labels.emitLabel(skipLabel)
        context.bytecode.emitOp(Opcode.OP_rot3r)
        context.bytecode.emitOp(Opcode.OP_drop)
        context.bytecode.emitOp(Opcode.OP_drop)
        context.labels.emitLabel(endLabel)
        return
      }

      if (logicalKind === '||') {
        const skipLabel = context.labels.emitGoto(Opcode.OP_if_true, -1)
        context.bytecode.emitOp(Opcode.OP_drop)
        context.bytecode.emitOp(Opcode.OP_drop)
        emitExpression(right, context)
        context.bytecode.emitOp(Opcode.OP_insert3)
        context.bytecode.emitOp(Opcode.OP_put_array_el)
        context.labels.emitGoto(Opcode.OP_goto, endLabel)
        context.labels.emitLabel(skipLabel)
        context.bytecode.emitOp(Opcode.OP_rot3r)
        context.bytecode.emitOp(Opcode.OP_drop)
        context.bytecode.emitOp(Opcode.OP_drop)
        context.labels.emitLabel(endLabel)
        return
      }

      context.bytecode.emitOp(Opcode.OP_is_undefined_or_null)
      const assignLabel = context.labels.emitGoto(Opcode.OP_if_true, -1)
      context.bytecode.emitOp(Opcode.OP_rot3r)
      context.bytecode.emitOp(Opcode.OP_drop)
      context.bytecode.emitOp(Opcode.OP_drop)
      context.labels.emitGoto(Opcode.OP_goto, endLabel)
      context.labels.emitLabel(assignLabel)
      context.bytecode.emitOp(Opcode.OP_drop)
      emitExpression(right, context)
      context.bytecode.emitOp(Opcode.OP_insert3)
      context.bytecode.emitOp(Opcode.OP_put_array_el)
      context.labels.emitLabel(endLabel)
      return
    }

    throw new Error(`未支持的逻辑赋值左值: ${ts.SyntaxKind[left.kind]}`)
  }

  private getCompoundOpcode(kind: ts.SyntaxKind): Opcode | null {
    switch (kind) {
      case ts.SyntaxKind.PlusEqualsToken:
        return Opcode.OP_add
      case ts.SyntaxKind.MinusEqualsToken:
        return Opcode.OP_sub
      case ts.SyntaxKind.AsteriskEqualsToken:
        return Opcode.OP_mul
      case ts.SyntaxKind.SlashEqualsToken:
        return Opcode.OP_div
      case ts.SyntaxKind.PercentEqualsToken:
        return Opcode.OP_mod
      case ts.SyntaxKind.AsteriskAsteriskEqualsToken:
        return Opcode.OP_pow
      case ts.SyntaxKind.LessThanLessThanEqualsToken:
        return Opcode.OP_shl
      case ts.SyntaxKind.GreaterThanGreaterThanEqualsToken:
        return Opcode.OP_sar
      case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
        return Opcode.OP_shr
      case ts.SyntaxKind.AmpersandEqualsToken:
        return Opcode.OP_and
      case ts.SyntaxKind.BarEqualsToken:
        return Opcode.OP_or
      case ts.SyntaxKind.CaretEqualsToken:
        return Opcode.OP_xor
      default:
        return null
    }
  }

  private getLogicalAssignmentKind(kind: ts.SyntaxKind): '&&' | '||' | '??' | null {
    switch (kind) {
      case ts.SyntaxKind.AmpersandAmpersandEqualsToken:
        return '&&'
      case ts.SyntaxKind.BarBarEqualsToken:
        return '||'
      case ts.SyntaxKind.QuestionQuestionEqualsToken:
        return '??'
      default:
        return null
    }
  }
}
