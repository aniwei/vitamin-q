import ts from 'typescript'

import { Opcode } from '../env'
import type { JSAtom } from '../env'

import type { EmitterContext } from './emitter'

const isInt32 = (value: number): boolean => Number.isInteger(value) && value >= -2147483648 && value <= 2147483647

const emitPushConst = (context: EmitterContext, value: unknown) => {
  const index = context.constantPool.add(value)
  context.bytecode.emitOp(Opcode.OP_push_const)
  context.bytecode.emitU32(index)
}

const emitPushAtomValue = (context: EmitterContext, atom: JSAtom) => {
  context.bytecode.emitOp(Opcode.OP_push_atom_value)
  context.bytecode.emitU32(atom)
  context.bytecode.emitIC(atom)
}

/**
 * 表达式发射器。
 *
 * @source QuickJS/src/core/parser.c:6331-6482
 * @see js_parse_expr
 */
export class ExpressionEmitter {
  /**
   * 发射表达式。
   *
   * @source QuickJS/src/core/parser.c:6331-6482
   * @see js_parse_expr
   */
  emitExpression(node: ts.Expression, context: EmitterContext) {
    if (ts.isParenthesizedExpression(node)) {
      this.emitExpression(node.expression, context)
      return
    }

    if (ts.isNumericLiteral(node)) {
      const value = Number(node.text)
      if (isInt32(value)) {
        context.bytecode.emitOp(Opcode.OP_push_i32)
        context.bytecode.emitU32(value >>> 0)
      } else {
        emitPushConst(context, value)
      }
      return
    }

    if (ts.isBigIntLiteral(node)) {
      emitPushConst(context, BigInt(node.text.replace(/n$/, '')))
      return
    }

    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const value = node.text
      if (context.atomTable) {
        const atom = context.atomTable.getOrAdd(value)
        emitPushAtomValue(context, atom)
      } else {
        emitPushConst(context, value)
      }
      return
    }

    if (node.kind === ts.SyntaxKind.TrueKeyword) {
      context.bytecode.emitOp(Opcode.OP_push_true)
      return
    }

    if (node.kind === ts.SyntaxKind.FalseKeyword) {
      context.bytecode.emitOp(Opcode.OP_push_false)
      return
    }

    if (node.kind === ts.SyntaxKind.NullKeyword) {
      context.bytecode.emitOp(Opcode.OP_null)
      return
    }

    if (ts.isTypeOfExpression(node)) {
      this.emitExpression(node.expression, context)
      context.bytecode.emitOp(Opcode.OP_typeof)
      return
    }

    if (ts.isPrefixUnaryExpression(node)) {
      this.emitExpression(node.operand, context)
      switch (node.operator) {
        case ts.SyntaxKind.ExclamationToken:
          context.bytecode.emitOp(Opcode.OP_not)
          return
        case ts.SyntaxKind.MinusToken:
          context.bytecode.emitOp(Opcode.OP_neg)
          return
        case ts.SyntaxKind.TildeToken:
          context.bytecode.emitOp(Opcode.OP_not)
          return
        default:
          throw new Error(`未支持的一元运算符: ${ts.SyntaxKind[node.operator]}`)
      }
    }

    if (ts.isBinaryExpression(node)) {
      this.emitExpression(node.left, context)
      this.emitExpression(node.right, context)
      const opcode = this.getBinaryOpcode(node.operatorToken.kind)
      if (opcode === null) {
        throw new Error(`未支持的二元运算符: ${ts.SyntaxKind[node.operatorToken.kind]}`)
      }
      context.bytecode.emitOp(opcode)
      return
    }

    throw new Error(`未支持表达式: ${ts.SyntaxKind[node.kind]}`)
  }

  private getBinaryOpcode(kind: ts.SyntaxKind): Opcode | null {
    switch (kind) {
      case ts.SyntaxKind.AsteriskToken:
        return Opcode.OP_mul
      case ts.SyntaxKind.SlashToken:
        return Opcode.OP_div
      case ts.SyntaxKind.PercentToken:
        return Opcode.OP_mod
      case ts.SyntaxKind.PlusToken:
        return Opcode.OP_add
      case ts.SyntaxKind.MinusToken:
        return Opcode.OP_sub
      case ts.SyntaxKind.LessThanLessThanToken:
        return Opcode.OP_shl
      case ts.SyntaxKind.GreaterThanGreaterThanToken:
        return Opcode.OP_sar
      case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
        return Opcode.OP_shr
      case ts.SyntaxKind.LessThanToken:
        return Opcode.OP_lt
      case ts.SyntaxKind.LessThanEqualsToken:
        return Opcode.OP_lte
      case ts.SyntaxKind.GreaterThanToken:
        return Opcode.OP_gt
      case ts.SyntaxKind.GreaterThanEqualsToken:
        return Opcode.OP_gte
      case ts.SyntaxKind.EqualsEqualsToken:
        return Opcode.OP_eq
      case ts.SyntaxKind.ExclamationEqualsToken:
        return Opcode.OP_neq
      case ts.SyntaxKind.EqualsEqualsEqualsToken:
        return Opcode.OP_strict_eq
      case ts.SyntaxKind.ExclamationEqualsEqualsToken:
        return Opcode.OP_strict_neq
      case ts.SyntaxKind.AmpersandToken:
        return Opcode.OP_and
      case ts.SyntaxKind.BarToken:
        return Opcode.OP_or
      case ts.SyntaxKind.CaretToken:
        return Opcode.OP_xor
      default:
        return null
    }
  }
}
