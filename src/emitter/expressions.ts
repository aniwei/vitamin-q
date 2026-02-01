import ts from 'typescript'

import { Opcode, OPSpecialObjectEnum, TempOpcode } from '../env'
import type { JSAtom } from '../env'

import { AssignmentEmitter } from './assignment'
import { LiteralEmitter } from './literals'
import { emitRegexpLiteral } from './regexp'
import { FunctionEmitter } from './functions'
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

const emitStringLiteral = (context: EmitterContext, value: string) => {
  if (context.atomTable) {
    const atom = context.atomTable.getOrAdd(value)
    emitPushAtomValue(context, atom)
  } else {
    emitPushConst(context, value)
  }
}

/**
 * 表达式发射器。
 *
 * @source QuickJS/src/core/parser.c:6331-6482
 * @see js_parse_expr
 */
export class ExpressionEmitter {
  private assignmentEmitter = new AssignmentEmitter()
  private literalEmitter = new LiteralEmitter()
  private functionEmitter = new FunctionEmitter()

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

    if (ts.isArrayLiteralExpression(node)) {
      this.literalEmitter.emitArrayLiteral(node, context, this.emitExpression.bind(this))
      return
    }

    if (ts.isObjectLiteralExpression(node)) {
      this.literalEmitter.emitObjectLiteral(node, context, this.emitExpression.bind(this))
      return
    }

    if (ts.isBigIntLiteral(node)) {
      emitPushConst(context, BigInt(node.text.replace(/n$/, '')))
      return
    }

    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      emitStringLiteral(context, node.text)
      return
    }

    if (ts.isRegularExpressionLiteral(node)) {
      emitRegexpLiteral(node.text, context)
      return
    }

    if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
      this.functionEmitter.emitFunctionExpression(node, context)
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

    if (node.kind === ts.SyntaxKind.ThisKeyword) {
      context.bytecode.emitOp(Opcode.OP_push_this)
      return
    }

    if (node.kind === ts.SyntaxKind.SuperKeyword) {
      context.bytecode.emitOp(Opcode.OP_get_super)
      return
    }

    if (ts.isYieldExpression(node)) {
      if (!context.inGenerator) {
        throw new Error('yield 只能出现在生成器函数中')
      }
      if (node.expression) {
        this.emitExpression(node.expression, context)
      } else {
        context.bytecode.emitOp(Opcode.OP_undefined)
      }
      if (node.asteriskToken) {
        context.bytecode.emitOp(Opcode.OP_yield_star)
      } else {
        context.bytecode.emitOp(Opcode.OP_yield)
      }
      return
    }

    if (ts.isIdentifier(node)) {
      const atom = context.getAtom(node.text)
      const scopeLevel = context.scopes.scopeLevel
      if (scopeLevel >= 0) {
        const localIdx = context.scopes.findVarInScope(atom, scopeLevel)
        if (localIdx >= 0) {
          context.bytecode.emitOp(Opcode.OP_get_loc)
          context.bytecode.emitU16(localIdx)
          return
        }
      }
      const argIndex = context.getArgIndex(node.text)
      if (argIndex >= 0) {
        context.bytecode.emitOp(Opcode.OP_get_arg)
        context.bytecode.emitU16(argIndex)
        return
      }
      if (context.inFunction && node.text === 'arguments') {
        context.bytecode.emitOp(Opcode.OP_special_object)
        context.bytecode.emitU8(OPSpecialObjectEnum.OP_SPECIAL_OBJECT_ARGUMENTS)
        return
      }
      const withIdx = context.findWithVarIndex()
      if (withIdx >= 0) {
        const label = context.labels.newLabel()
        context.bytecode.emitOp(Opcode.OP_get_loc)
        context.bytecode.emitU16(withIdx)
        context.bytecode.emitOp(Opcode.OP_with_get_var)
        context.bytecode.emitAtom(atom)
        context.bytecode.emitU32(label)
        context.bytecode.emitU8(1)
        context.bytecode.emitOp(Opcode.OP_get_var)
        context.bytecode.emitAtom(atom)
        context.labels.emitLabel(label)
        return
      }
      context.bytecode.emitOp(Opcode.OP_get_var)
      context.bytecode.emitAtom(atom)
      return
    }

    if (ts.isPropertyAccessChain(node)) {
      if (node.expression.kind === ts.SyntaxKind.SuperKeyword) {
        throw new Error('super optional chaining 尚未实现')
      }
      this.emitExpression(node.expression, context)
      const atom = context.getAtom(node.name.text)
      context.bytecode.emitOp(TempOpcode.OP_get_field_opt_chain)
      context.bytecode.emitAtom(atom)
      return
    }

    if (ts.isPropertyAccessExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.SuperKeyword) {
        context.bytecode.emitOp(Opcode.OP_get_super)
        emitStringLiteral(context, node.name.text)
        context.bytecode.emitOp(Opcode.OP_get_super_value)
        return
      }
      this.emitExpression(node.expression, context)
      const atom = context.getAtom(node.name.text)
      context.bytecode.emitOp(Opcode.OP_get_field)
      context.bytecode.emitAtom(atom)
      return
    }

    if (ts.isTemplateExpression(node)) {
      emitStringLiteral(context, node.head.text)
      for (const span of node.templateSpans) {
        this.emitExpression(span.expression, context)
        context.bytecode.emitOp(Opcode.OP_add)
        emitStringLiteral(context, span.literal.text)
        context.bytecode.emitOp(Opcode.OP_add)
      }
      return
    }

    if (ts.isMetaProperty(node)) {
      if (node.keywordToken === ts.SyntaxKind.ImportKeyword && node.name.text === 'meta') {
        context.bytecode.emitOp(Opcode.OP_special_object)
        context.bytecode.emitU8(OPSpecialObjectEnum.OP_SPECIAL_OBJECT_IMPORT_META)
        return
      }
      if (node.keywordToken === ts.SyntaxKind.NewKeyword && node.name.text === 'target') {
        context.bytecode.emitOp(Opcode.OP_special_object)
        context.bytecode.emitU8(OPSpecialObjectEnum.OP_SPECIAL_OBJECT_NEW_TARGET)
        return
      }
    }

    if (ts.isElementAccessChain(node)) {
      if (node.expression.kind === ts.SyntaxKind.SuperKeyword) {
        throw new Error('super optional chaining 尚未实现')
      }
      this.emitExpression(node.expression, context)
      this.emitExpression(node.argumentExpression, context)
      context.bytecode.emitOp(TempOpcode.OP_get_array_el_opt_chain)
      return
    }

    if (ts.isElementAccessExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.SuperKeyword) {
        context.bytecode.emitOp(Opcode.OP_get_super)
        this.emitExpression(node.argumentExpression, context)
        context.bytecode.emitOp(Opcode.OP_get_super_value)
        return
      }
      this.emitExpression(node.expression, context)
      this.emitExpression(node.argumentExpression, context)
      context.bytecode.emitOp(Opcode.OP_get_array_el)
      return
    }

    if (ts.isNewExpression(node)) {
      this.emitExpression(node.expression, context)
      const args = node.arguments ?? []
      for (const arg of args) {
        this.emitExpression(arg, context)
      }
      context.bytecode.emitOp(Opcode.OP_call_constructor)
      context.bytecode.emitU16(args.length)
      return
    }

    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        if (node.arguments.length !== 1) {
          throw new Error('dynamic import 仅支持单参数')
        }
        context.bytecode.emitOp(Opcode.OP_special_object)
        context.bytecode.emitU8(OPSpecialObjectEnum.OP_SPECIAL_OBJECT_IMPORT_META)
        this.emitExpression(node.arguments[0], context)
        context.bytecode.emitOp(Opcode.OP_import)
        return
      }

      if (node.expression.kind === ts.SyntaxKind.SuperKeyword) {
        context.bytecode.emitOp(Opcode.OP_get_super)
        for (const arg of node.arguments) {
          this.emitExpression(arg, context)
        }
        context.bytecode.emitOp(Opcode.OP_call_constructor)
        context.bytecode.emitU16(node.arguments.length)
        return
      }

      if (ts.isCallChain(node)) {
        const endLabel = context.labels.newLabel()

        if (ts.isPropertyAccessChain(node.expression)) {
          this.emitExpression(node.expression.expression, context)
          context.bytecode.emitOp(Opcode.OP_dup)
          context.bytecode.emitOp(Opcode.OP_is_undefined_or_null)
          const okLabel = context.labels.emitGoto(Opcode.OP_if_false, -1)
          context.bytecode.emitOp(Opcode.OP_drop)
          context.bytecode.emitOp(Opcode.OP_undefined)
          context.labels.emitGoto(Opcode.OP_goto, endLabel)
          context.labels.emitLabel(okLabel)
          const atom = context.getAtom(node.expression.name.text)
          context.bytecode.emitOp(Opcode.OP_get_field2)
          context.bytecode.emitAtom(atom)
          for (const arg of node.arguments) {
            this.emitExpression(arg, context)
          }
          context.bytecode.emitOp(Opcode.OP_call_method)
          context.bytecode.emitU16(node.arguments.length)
          context.labels.emitLabel(endLabel)
          return
        }

        if (ts.isElementAccessChain(node.expression)) {
          this.emitExpression(node.expression.expression, context)
          context.bytecode.emitOp(Opcode.OP_dup)
          context.bytecode.emitOp(Opcode.OP_is_undefined_or_null)
          const okLabel = context.labels.emitGoto(Opcode.OP_if_false, -1)
          context.bytecode.emitOp(Opcode.OP_drop)
          context.bytecode.emitOp(Opcode.OP_undefined)
          context.labels.emitGoto(Opcode.OP_goto, endLabel)
          context.labels.emitLabel(okLabel)
          this.emitExpression(node.expression.argumentExpression, context)
          context.bytecode.emitOp(Opcode.OP_get_array_el2)
          for (const arg of node.arguments) {
            this.emitExpression(arg, context)
          }
          context.bytecode.emitOp(Opcode.OP_call_method)
          context.bytecode.emitU16(node.arguments.length)
          context.labels.emitLabel(endLabel)
          return
        }

        this.emitExpression(node.expression, context)
        context.bytecode.emitOp(Opcode.OP_dup)
        context.bytecode.emitOp(Opcode.OP_is_undefined_or_null)
        const okLabel = context.labels.emitGoto(Opcode.OP_if_false, -1)
        context.bytecode.emitOp(Opcode.OP_drop)
        context.bytecode.emitOp(Opcode.OP_undefined)
        context.labels.emitGoto(Opcode.OP_goto, endLabel)
        context.labels.emitLabel(okLabel)
        for (const arg of node.arguments) {
          this.emitExpression(arg, context)
        }
        context.bytecode.emitOp(Opcode.OP_call)
        context.bytecode.emitU16(node.arguments.length)
        context.labels.emitLabel(endLabel)
        return
      }

      if (ts.isPropertyAccessChain(node.expression) || ts.isElementAccessChain(node.expression)) {
        throw new Error('optional call 尚未实现')
      }

      if (ts.isPropertyAccessExpression(node.expression)) {
        if (node.expression.expression.kind === ts.SyntaxKind.SuperKeyword) {
          context.bytecode.emitOp(Opcode.OP_get_super)
          emitStringLiteral(context, node.expression.name.text)
          context.bytecode.emitOp(Opcode.OP_get_array_el)
          for (const arg of node.arguments) {
            this.emitExpression(arg, context)
          }
          context.bytecode.emitOp(Opcode.OP_call_method)
          context.bytecode.emitU16(node.arguments.length)
          return
        }
        this.emitExpression(node.expression.expression, context)
        const atom = context.getAtom(node.expression.name.text)
        context.bytecode.emitOp(Opcode.OP_get_field2)
        context.bytecode.emitAtom(atom)
        for (const arg of node.arguments) {
          this.emitExpression(arg, context)
        }
        context.bytecode.emitOp(Opcode.OP_call_method)
        context.bytecode.emitU16(node.arguments.length)
        return
      }

      if (ts.isElementAccessExpression(node.expression)) {
        if (node.expression.expression.kind === ts.SyntaxKind.SuperKeyword) {
          context.bytecode.emitOp(Opcode.OP_get_super)
          this.emitExpression(node.expression.argumentExpression, context)
          context.bytecode.emitOp(Opcode.OP_get_array_el)
          for (const arg of node.arguments) {
            this.emitExpression(arg, context)
          }
          context.bytecode.emitOp(Opcode.OP_call_method)
          context.bytecode.emitU16(node.arguments.length)
          return
        }
        this.emitExpression(node.expression.expression, context)
        this.emitExpression(node.expression.argumentExpression, context)
        context.bytecode.emitOp(Opcode.OP_get_array_el2)
        for (const arg of node.arguments) {
          this.emitExpression(arg, context)
        }
        context.bytecode.emitOp(Opcode.OP_call_method)
        context.bytecode.emitU16(node.arguments.length)
        return
      }

      this.emitExpression(node.expression, context)
      for (const arg of node.arguments) {
        this.emitExpression(arg, context)
      }
      context.bytecode.emitOp(Opcode.OP_call)
      context.bytecode.emitU16(node.arguments.length)
      return
    }

    if (ts.isTypeOfExpression(node)) {
      this.emitExpression(node.expression, context)
      context.bytecode.emitOp(Opcode.OP_typeof)
      return
    }

    if (ts.isAwaitExpression(node)) {
      this.emitExpression(node.expression, context)
      context.bytecode.emitOp(Opcode.OP_await)
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
      const opKind = node.operatorToken.kind
      if (this.isAssignmentOperator(opKind)) {
        this.assignmentEmitter.emitAssignment(node, context, this.emitExpression.bind(this))
        return
      }
      if (opKind === ts.SyntaxKind.AmpersandAmpersandToken) {
        this.emitExpression(node.left, context)
        context.bytecode.emitOp(Opcode.OP_dup)
        const falseLabel = context.labels.emitGoto(Opcode.OP_if_false, -1)
        context.bytecode.emitOp(Opcode.OP_drop)
        this.emitExpression(node.right, context)
        const endLabel = context.labels.emitGoto(Opcode.OP_goto, -1)
        context.labels.emitLabel(falseLabel)
        context.labels.emitLabel(endLabel)
        return
      }

      if (opKind === ts.SyntaxKind.BarBarToken) {
        this.emitExpression(node.left, context)
        context.bytecode.emitOp(Opcode.OP_dup)
        const trueLabel = context.labels.emitGoto(Opcode.OP_if_true, -1)
        context.bytecode.emitOp(Opcode.OP_drop)
        this.emitExpression(node.right, context)
        const endLabel = context.labels.emitGoto(Opcode.OP_goto, -1)
        context.labels.emitLabel(trueLabel)
        context.labels.emitLabel(endLabel)
        return
      }

      if (opKind === ts.SyntaxKind.QuestionQuestionToken) {
        this.emitExpression(node.left, context)
        context.bytecode.emitOp(Opcode.OP_dup)
        context.bytecode.emitOp(Opcode.OP_is_undefined_or_null)
        const rightLabel = context.labels.emitGoto(Opcode.OP_if_true, -1)
        const endLabel = context.labels.emitGoto(Opcode.OP_goto, -1)
        context.labels.emitLabel(rightLabel)
        context.bytecode.emitOp(Opcode.OP_drop)
        this.emitExpression(node.right, context)
        context.labels.emitLabel(endLabel)
        return
      }

      this.emitExpression(node.left, context)
      this.emitExpression(node.right, context)
      const opcode = this.getBinaryOpcode(opKind)
      if (opcode === null) {
        throw new Error(`未支持的二元运算符: ${ts.SyntaxKind[node.operatorToken.kind]}`)
      }
      context.bytecode.emitOp(opcode)
      return
    }

    if (ts.isConditionalExpression(node)) {
      this.emitExpression(node.condition, context)
      const falseLabel = context.labels.emitGoto(Opcode.OP_if_false, -1)
      this.emitExpression(node.whenTrue, context)
      const endLabel = context.labels.emitGoto(Opcode.OP_goto, -1)
      context.labels.emitLabel(falseLabel)
      this.emitExpression(node.whenFalse, context)
      context.labels.emitLabel(endLabel)
      return
    }

    throw new Error(`未支持表达式: ${ts.SyntaxKind[node.kind]}`)
  }

  private isAssignmentOperator(kind: ts.SyntaxKind): boolean {
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
      case ts.SyntaxKind.AmpersandAmpersandEqualsToken:
      case ts.SyntaxKind.BarBarEqualsToken:
      case ts.SyntaxKind.QuestionQuestionEqualsToken:
        return true
      default:
        return false
    }
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
