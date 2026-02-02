import ts from 'typescript'

import { JS_ATOM_NULL, Opcode, OPSpecialObjectEnum, TempOpcode } from '../env'
import type { JSAtom } from '../env'

import { AssignmentEmitter } from './assignment'
import { AsyncEmitter } from './async'
import { GeneratorEmitter } from './generators'
import { LiteralEmitter } from './literals'
import { emitRegexpLiteral } from './regexp'
import { FunctionEmitter } from './functions'
import { ClassEmitter } from './classes'
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
  private classEmitter = new ClassEmitter()
  private generatorEmitter = new GeneratorEmitter()
  private asyncEmitter = new AsyncEmitter()

  /**
   * 发射表达式。
   *
   * @source QuickJS/src/core/parser.c:6331-6482
   * @see js_parse_expr
   */
  emitExpression(node: ts.Expression, context: EmitterContext) {
    switch (true) {
      case ts.isParenthesizedExpression(node):
        return this.emitParenthesizedExpression(node, context)
      case ts.isNumericLiteral(node):
        return this.emitNumericLiteral(node, context)
      case ts.isArrayLiteralExpression(node):
        return this.emitArrayLiteralExpression(node, context)
      case ts.isObjectLiteralExpression(node):
        return this.emitObjectLiteralExpression(node, context)
      case ts.isBigIntLiteral(node):
        return this.emitBigIntLiteral(node, context)
      case ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node):
        return this.emitStringLiteralExpression(node, context)
      case ts.isRegularExpressionLiteral(node):
        return this.emitRegExpLiteralExpression(node, context)
      case ts.isFunctionExpression(node) || ts.isArrowFunction(node):
        return this.emitFunctionLikeExpression(node, context)
      case ts.isClassExpression(node):
        return this.emitClassExpressionNode(node, context)
      case node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword:
        return this.emitBooleanLiteral(node.kind as ts.SyntaxKind.TrueKeyword | ts.SyntaxKind.FalseKeyword, context)
      case node.kind === ts.SyntaxKind.NullKeyword:
        return this.emitNullLiteral(context)
      case node.kind === ts.SyntaxKind.ThisKeyword:
        return this.emitThisExpression(context)
      case node.kind === ts.SyntaxKind.SuperKeyword:
        return this.emitSuperExpression(context)
      case ts.isYieldExpression(node):
        return this.emitYieldExpression(node, context)
      case ts.isIdentifier(node):
        return this.emitIdentifier(node, context)
      case ts.isPropertyAccessChain(node):
        return this.emitPropertyAccessChain(node, context)
      case ts.isPropertyAccessExpression(node):
        return this.emitPropertyAccessExpression(node, context)
      case ts.isTemplateExpression(node):
        return this.emitTemplateExpression(node, context)
      case ts.isMetaProperty(node):
        return this.emitMetaProperty(node, context)
      case ts.isElementAccessChain(node):
        return this.emitElementAccessChain(node, context)
      case ts.isElementAccessExpression(node):
        return this.emitElementAccessExpression(node, context)
      case ts.isNewExpression(node):
        return this.emitNewExpression(node, context)
      case ts.isCallExpression(node):
        return this.emitCallExpression(node, context)
      case ts.isTypeOfExpression(node):
        return this.emitTypeOfExpression(node, context)
      case ts.isAwaitExpression(node):
        return this.emitAwaitExpression(node, context)
      case ts.isAsExpression(node) || ts.isTypeAssertionExpression(node):
        return this.emitTypeCastExpression(node, context)
      case ts.isPrefixUnaryExpression(node):
        return this.emitPrefixUnaryExpression(node, context)
      case ts.isPostfixUnaryExpression(node):
        return this.emitPostfixUnaryExpression(node, context)
      case ts.isBinaryExpression(node):
        return this.emitBinaryExpression(node, context)
      case ts.isConditionalExpression(node):
        return this.emitConditionalExpression(node, context)
      default:
        throw new Error(`未支持表达式: ${ts.SyntaxKind[node.kind]}`)
    }
  }

  /**
   * @source QuickJS/src/core/parser.c:4154-4165
   * @see js_parse_expr_paren
   */
  private emitParenthesizedExpression(node: ts.ParenthesizedExpression, context: EmitterContext) {
    this.emitExpression(node.expression, context)
  }

  /**
   * @source QuickJS/src/core/parser.c:4848-4870
   * @see js_parse_postfix_expr
   */
  private emitNumericLiteral(node: ts.NumericLiteral, context: EmitterContext) {
    const value = Number(node.text)
    if (isInt32(value)) {
      context.bytecode.emitOp(Opcode.OP_push_i32)
      context.bytecode.emitU32(value >>> 0)
    } else {
      emitPushConst(context, value)
    }
  }

  /**
   * @source QuickJS/src/core/parser.c:2928-3042
   * @see js_parse_array_literal
   */
  private emitArrayLiteralExpression(node: ts.ArrayLiteralExpression, context: EmitterContext) {
    this.literalEmitter.emitArrayLiteral(node, context, this.emitExpression.bind(this))
  }

  /**
   * @source QuickJS/src/core/parser.c:3760-3885
   * @see js_parse_object_literal
   */
  private emitObjectLiteralExpression(node: ts.ObjectLiteralExpression, context: EmitterContext) {
    this.literalEmitter.emitObjectLiteral(node, context, this.emitExpression.bind(this))
  }

  /**
   * @source QuickJS/src/core/parser.c:4852-4866
   * @see js_parse_postfix_expr
   */
  private emitBigIntLiteral(node: ts.BigIntLiteral, context: EmitterContext) {
    emitPushConst(context, BigInt(node.text.replace(/n$/, '')))
  }

  /**
   * @source QuickJS/src/core/parser.c:4877-4884
   * @see js_parse_postfix_expr
   */
  private emitStringLiteralExpression(
    node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral,
    context: EmitterContext,
  ) {
    emitStringLiteral(context, node.text)
  }

  /**
   * @source QuickJS/src/core/parser.c:4888-4927
   * @see js_parse_postfix_expr
   */
  private emitRegExpLiteralExpression(node: ts.RegularExpressionLiteral, context: EmitterContext) {
    emitRegexpLiteral(node.text, context)
  }

  /**
   * @source QuickJS/src/core/parser.c:4929-4936
   * @see js_parse_postfix_expr
   */
  private emitFunctionLikeExpression(node: ts.FunctionExpression | ts.ArrowFunction, context: EmitterContext) {
    this.functionEmitter.emitFunctionExpression(node, context)
  }

  /**
   * @source QuickJS/src/core/parser.c:4938-4941
   * @see js_parse_postfix_expr
   */
  private emitClassExpressionNode(node: ts.ClassExpression, context: EmitterContext) {
    this.classEmitter.emitClassExpression(node, context, this.emitExpression.bind(this))
  }

  /**
   * @source QuickJS/src/core/parser.c:4954-4961
   * @see js_parse_postfix_expr
   */
  private emitBooleanLiteral(kind: ts.SyntaxKind.TrueKeyword | ts.SyntaxKind.FalseKeyword, context: EmitterContext) {
    context.bytecode.emitOp(kind === ts.SyntaxKind.TrueKeyword ? Opcode.OP_push_true : Opcode.OP_push_false)
  }

  /**
   * @source QuickJS/src/core/parser.c:4942-4945
   * @see js_parse_postfix_expr
   */
  private emitNullLiteral(context: EmitterContext) {
    context.bytecode.emitOp(Opcode.OP_null)
  }

  /**
   * @source QuickJS/src/core/parser.c:4947-4952
   * @see js_parse_postfix_expr
   */
  private emitThisExpression(context: EmitterContext) {
    const thisIndex = context.getSpecialVar('this')
    if (thisIndex !== undefined) {
      context.bytecode.emitOp(Opcode.OP_get_loc)
      context.bytecode.emitU16(thisIndex)
    } else {
      context.bytecode.emitOp(Opcode.OP_push_this)
    }
  }

  /**
   * @source QuickJS/src/core/parser.c:5047-5073
   * @see js_parse_postfix_expr
   */
  private emitSuperExpression(context: EmitterContext) {
    context.bytecode.emitOp(Opcode.OP_get_super)
  }

  /**
   * @source QuickJS/src/core/parser.c:5995-6150
   * @see js_parse_assign_expr2
   */
  private emitYieldExpression(node: ts.YieldExpression, context: EmitterContext) {
    if (!context.inGenerator) {
      throw new Error('yield 只能出现在生成器函数中')
    }
    if (context.inAsync && context.inGenerator && !node.asteriskToken) {
      this.asyncEmitter.emitAsyncGeneratorYield(node, context, this.emitExpression.bind(this))
      return
    }
    if (node.asteriskToken) {
      if (context.inAsync && context.inGenerator) {
        this.asyncEmitter.emitAsyncYieldStar(node.expression, context, this.emitExpression.bind(this))
        return
      }
      this.generatorEmitter.emitYieldStar(node.expression, context, this.emitExpression.bind(this))
      return
    }

    this.generatorEmitter.emitYieldExpression(node, context, this.emitExpression.bind(this))
  }

  /**
   * @source QuickJS/src/core/parser.c:4962-5030
   * @see js_parse_postfix_expr
   */
  private emitIdentifier(node: ts.Identifier, context: EmitterContext) {
    const atom = context.getAtom(node.text)
    const scopeLevel = context.scopes.scopeLevel
    if (scopeLevel >= 0) {
      const localIdx = context.scopes.findVarInScope(atom, scopeLevel)
      if (localIdx >= 0) {
        const vd = context.scopes.vars[localIdx]
        if (vd?.isLexical) {
          context.bytecode.emitOp(Opcode.OP_get_loc_check)
        } else {
          context.bytecode.emitOp(Opcode.OP_get_loc)
        }
        context.bytecode.emitU16(localIdx)
        return
      }
    }
    const argIndex = context.getArgIndex(node.text)
    if (argIndex >= 0) {
      const { buffer } = context.bytecode.bytecode.snapshot()
      const lastPos = context.bytecode.lastOpcodePos
      const lastOpcode = buffer[lastPos]
      const matchesSetArg = (() => {
        switch (lastOpcode) {
          case Opcode.OP_set_arg0:
            return argIndex === 0
          case Opcode.OP_set_arg1:
            return argIndex === 1
          case Opcode.OP_set_arg2:
            return argIndex === 2
          case Opcode.OP_set_arg3:
            return argIndex === 3
          case Opcode.OP_set_arg: {
            const lo = buffer[lastPos + 1]
            const hi = buffer[lastPos + 2]
            const idx = lo | (hi << 8)
            return idx === argIndex
          }
          default:
            return false
        }
      })()

      if (matchesSetArg) {
        return
      }
      context.bytecode.emitOp(Opcode.OP_get_arg)
      context.bytecode.emitU16(argIndex)
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
  }

  /**
   * @source QuickJS/src/core/parser.c:5125-5510
   * @see js_parse_postfix_expr
   */
  private emitPropertyAccessChain(node: ts.PropertyAccessChain, context: EmitterContext) {
    if (node.expression.kind === ts.SyntaxKind.SuperKeyword) {
      throw new Error('super optional chaining 尚未实现')
    }
    this.emitExpression(node.expression, context)
    const atom = context.getAtom(node.name.text)
    context.bytecode.emitOp(TempOpcode.OP_get_field_opt_chain)
    context.bytecode.emitAtom(atom)
  }

  /**
   * @source QuickJS/src/core/parser.c:5440-5475
   * @see js_parse_postfix_expr
   */
  private emitPropertyAccessExpression(node: ts.PropertyAccessExpression, context: EmitterContext) {
    if (ts.isPrivateIdentifier(node.name)) {
      const binding = context.getPrivateBinding(node.name.text)
      if (!binding) {
        throw new Error(`未知的私有成员: ${node.name.text}`)
      }
      this.emitExpression(node.expression, context)
      context.bytecode.emitOp(Opcode.OP_get_var_ref)
      context.bytecode.emitU16(binding.index)
      if (binding.kind === 'field') {
        context.bytecode.emitOp(Opcode.OP_get_private_field)
        return
      }
      if (binding.kind === 'accessor') {
        context.bytecode.emitOp(Opcode.OP_check_brand)
        context.bytecode.emitOp(Opcode.OP_call_method)
        context.bytecode.emitU16(0)
        return
      }
      context.bytecode.emitOp(Opcode.OP_check_brand)
      context.bytecode.emitOp(Opcode.OP_nip)
      return
    }
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
  }

  /**
   * @source QuickJS/src/core/parser.c:2460-2570
   * @see js_parse_template
   */
  private emitTemplateExpression(node: ts.TemplateExpression, context: EmitterContext) {
    emitStringLiteral(context, node.head.text)
    for (const span of node.templateSpans) {
      this.emitExpression(span.expression, context)
      context.bytecode.emitOp(Opcode.OP_add)
      emitStringLiteral(context, span.literal.text)
      context.bytecode.emitOp(Opcode.OP_add)
    }
  }

  /**
   * @source QuickJS/src/core/parser.c:5008-5024 (new.target)
   * @source QuickJS/src/core/parser.c:5075-5096 (import.meta)
   * @see js_parse_postfix_expr
   */
  private emitMetaProperty(node: ts.MetaProperty, context: EmitterContext) {
    if (node.keywordToken === ts.SyntaxKind.ImportKeyword && node.name.text === 'meta') {
      context.bytecode.emitOp(Opcode.OP_special_object)
      context.bytecode.emitU8(OPSpecialObjectEnum.OP_SPECIAL_OBJECT_IMPORT_META)
      return
    }
    if (node.keywordToken === ts.SyntaxKind.NewKeyword && node.name.text === 'target') {
      const newTargetIndex = context.getSpecialVar('new.target')
      if (newTargetIndex !== undefined) {
        context.bytecode.emitOp(Opcode.OP_get_loc)
        context.bytecode.emitU16(newTargetIndex)
      } else {
        context.bytecode.emitOp(Opcode.OP_special_object)
        context.bytecode.emitU8(OPSpecialObjectEnum.OP_SPECIAL_OBJECT_NEW_TARGET)
      }
    }
  }

  /**
   * @source QuickJS/src/core/parser.c:5125-5510
   * @see js_parse_postfix_expr
   */
  private emitElementAccessChain(node: ts.ElementAccessChain, context: EmitterContext) {
    if (node.expression.kind === ts.SyntaxKind.SuperKeyword) {
      throw new Error('super optional chaining 尚未实现')
    }
    this.emitExpression(node.expression, context)
    this.emitExpression(node.argumentExpression, context)
    context.bytecode.emitOp(TempOpcode.OP_get_array_el_opt_chain)
  }

  /**
   * @source QuickJS/src/core/parser.c:5479-5491
   * @see js_parse_postfix_expr
   */
  private emitElementAccessExpression(node: ts.ElementAccessExpression, context: EmitterContext) {
    if (node.expression.kind === ts.SyntaxKind.SuperKeyword) {
      context.bytecode.emitOp(Opcode.OP_get_super)
      this.emitExpression(node.argumentExpression, context)
      context.bytecode.emitOp(Opcode.OP_get_super_value)
      return
    }
    this.emitExpression(node.expression, context)
    this.emitExpression(node.argumentExpression, context)
    context.bytecode.emitOp(Opcode.OP_get_array_el)
  }

  /**
   * @source QuickJS/src/core/parser.c:5008-5042
   * @source QuickJS/src/core/parser.c:5406-5425
   * @see js_parse_postfix_expr
   */
  private emitNewExpression(node: ts.NewExpression, context: EmitterContext) {
    this.emitExpression(node.expression, context)
    context.bytecode.emitOp(Opcode.OP_dup)
    const args = node.arguments ?? []
    for (const arg of args) {
      this.emitExpression(arg, context)
    }
    context.bytecode.emitOp(Opcode.OP_call_constructor)
    context.bytecode.emitU16(args.length)
  }

  /**
   * @source QuickJS/src/core/parser.c:5320-5425
   * @source QuickJS/src/core/parser.c:5125-5510 (optional chaining)
   * @see js_parse_postfix_expr
   */
  private emitCallExpression(node: ts.CallExpression | ts.CallChain, context: EmitterContext) {
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
      if (ts.isPrivateIdentifier(node.expression.name)) {
        const binding = context.getPrivateBinding(node.expression.name.text)
        if (!binding) {
          throw new Error(`未知的私有成员: ${node.expression.name.text}`)
        }
        this.emitExpression(node.expression.expression, context)
        context.bytecode.emitOp(Opcode.OP_get_var_ref)
        context.bytecode.emitU16(binding.index)
        context.bytecode.emitOp(Opcode.OP_check_brand)
        for (const arg of node.arguments) {
          this.emitExpression(arg, context)
        }
        context.bytecode.emitOp(Opcode.OP_call_method)
        context.bytecode.emitU16(node.arguments.length)
        return
      }
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
  }

  /**
   * @source QuickJS/src/core/parser.c:5658-5686
   * @see js_parse_unary
   */
  private emitTypeOfExpression(node: ts.TypeOfExpression, context: EmitterContext) {
    if (ts.isIdentifier(node.expression)) {
      this.emitTypeofIdentifier(node.expression, context)
    } else {
      this.emitExpression(node.expression, context)
    }
    context.bytecode.emitOp(Opcode.OP_typeof)
  }

  /**
   * @source QuickJS/src/core/parser.c:5686-5699
   * @see js_parse_unary
   */
  private emitAwaitExpression(node: ts.AwaitExpression, context: EmitterContext) {
    this.emitExpression(node.expression, context)
    context.bytecode.emitOp(Opcode.OP_await)
  }

  /**
   * @note QuickJS 不包含 TS 类型断言，保持透传表达式。
   */
  private emitTypeCastExpression(node: ts.AsExpression | ts.TypeAssertion, context: EmitterContext) {
    this.emitExpression(node.expression, context)
  }

  /**
   * @source QuickJS/src/core/parser.c:5602-5648
   * @see js_parse_unary
   */
  private emitPrefixUnaryExpression(node: ts.PrefixUnaryExpression, context: EmitterContext) {
    switch (node.operator) {
      case ts.SyntaxKind.PlusPlusToken:
        this.emitUpdateExpression(node.operand, context, true, true)
        return
      case ts.SyntaxKind.MinusMinusToken:
        this.emitUpdateExpression(node.operand, context, true, false)
        return
      case ts.SyntaxKind.ExclamationToken:
        this.emitExpression(node.operand, context)
        context.bytecode.emitOp(Opcode.OP_lnot)
        return
      case ts.SyntaxKind.MinusToken:
        this.emitExpression(node.operand, context)
        context.bytecode.emitOp(Opcode.OP_neg)
        return
      case ts.SyntaxKind.TildeToken:
        this.emitExpression(node.operand, context)
        context.bytecode.emitOp(Opcode.OP_not)
        return
      default:
        throw new Error(`未支持的一元运算符: ${ts.SyntaxKind[node.operator]}`)
    }
  }

  /**
   * @source QuickJS/src/core/parser.c:5700-5732
   * @see js_parse_unary
   */
  private emitPostfixUnaryExpression(node: ts.PostfixUnaryExpression, context: EmitterContext) {
    switch (node.operator) {
      case ts.SyntaxKind.PlusPlusToken:
        this.emitUpdateExpression(node.operand, context, false, true)
        return
      case ts.SyntaxKind.MinusMinusToken:
        this.emitUpdateExpression(node.operand, context, false, false)
        return
      default:
        throw new Error(`未支持的后缀一元运算符: ${ts.SyntaxKind[node.operator]}`)
    }
  }

  /**
   * @source QuickJS/src/core/parser.c:5860-5980
   * @see js_parse_expr_binary
   * @see js_parse_logical_and_or
   * @see js_parse_coalesce_expr
   */
  private emitBinaryExpression(node: ts.BinaryExpression, context: EmitterContext) {
    const opKind = node.operatorToken.kind
    if (opKind === ts.SyntaxKind.InKeyword && ts.isPrivateIdentifier(node.left)) {
      const binding = context.getPrivateBinding(node.left.text)
      if (!binding) {
        throw new Error(`未知的私有成员: ${node.left.text}`)
      }
      this.emitExpression(node.right, context)
      context.bytecode.emitOp(Opcode.OP_get_var_ref)
      context.bytecode.emitU16(binding.index)
      context.bytecode.emitOp(Opcode.OP_private_in)
      return
    }
    if (this.isAssignmentOperator(opKind)) {
      this.assignmentEmitter.emitAssignment(node, context, this.emitExpression.bind(this))
      return
    }
    if (opKind === ts.SyntaxKind.AmpersandAmpersandToken) {
      this.emitExpression(node.left, context)
      context.bytecode.emitOp(Opcode.OP_dup)
      const endLabel = context.labels.emitGoto(Opcode.OP_if_false, -1)
      context.bytecode.emitOp(Opcode.OP_drop)
      this.emitExpression(node.right, context)
      context.labels.emitLabel(endLabel)
      return
    }

    if (opKind === ts.SyntaxKind.BarBarToken) {
      this.emitExpression(node.left, context)
      context.bytecode.emitOp(Opcode.OP_dup)
      const endLabel = context.labels.emitGoto(Opcode.OP_if_true, -1)
      context.bytecode.emitOp(Opcode.OP_drop)
      this.emitExpression(node.right, context)
      context.labels.emitLabel(endLabel)
      return
    }

    if (opKind === ts.SyntaxKind.QuestionQuestionToken) {
      this.emitExpression(node.left, context)
      context.bytecode.emitOp(Opcode.OP_dup)
      context.bytecode.emitOp(Opcode.OP_is_undefined_or_null)
      const endLabel = context.labels.emitGoto(Opcode.OP_if_false, -1)
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
  }

  /**
   * @source QuickJS/src/core/parser.c:5985-6030
   * @see js_parse_cond_expr
   */
  private emitConditionalExpression(node: ts.ConditionalExpression, context: EmitterContext) {
    this.emitExpression(node.condition, context)
    const falseLabel = context.labels.emitGoto(Opcode.OP_if_false, -1)
    this.emitExpression(node.whenTrue, context)
    const endLabel = context.labels.emitGoto(Opcode.OP_goto, -1)
    context.labels.emitLabel(falseLabel)
    this.emitExpression(node.whenFalse, context)
    context.labels.emitLabel(endLabel)
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

  private emitTypeofIdentifier(node: ts.Identifier, context: EmitterContext) {
    const atom = context.getAtom(node.text)
    const scopeLevel = context.scopes.scopeLevel
    if (scopeLevel >= 0) {
      const localIdx = context.scopes.findVarInScope(atom, scopeLevel)
      if (localIdx >= 0) {
        const vd = context.scopes.vars[localIdx]
        if (vd?.isLexical) {
          context.bytecode.emitOp(Opcode.OP_get_loc_check)
        } else {
          context.bytecode.emitOp(Opcode.OP_get_loc)
        }
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
    context.bytecode.emitOp(Opcode.OP_get_var_undef)
    context.bytecode.emitAtom(atom)
  }

  private emitUpdateExpression(
    operand: ts.Expression,
    context: EmitterContext,
    isPrefix: boolean,
    isInc: boolean,
  ) {
    if (ts.isIdentifier(operand)) {
      this.emitUpdateIdentifier(operand, context, isPrefix, isInc)
      return
    }
    if (ts.isPropertyAccessExpression(operand)) {
      if (ts.isPrivateIdentifier(operand.name)) {
        const binding = context.getPrivateBinding(operand.name.text)
        if (!binding) {
          throw new Error(`未知的私有成员: ${operand.name.text}`)
        }
        if (binding.kind !== 'field') {
          throw new Error(`未支持的私有成员更新: ${operand.name.text}`)
        }
        this.emitExpression(operand.expression, context)
        context.bytecode.emitOp(Opcode.OP_get_var_ref)
        context.bytecode.emitU16(binding.index)
        context.bytecode.emitOp(Opcode.OP_get_private_field)
        context.bytecode.emitOp(isPrefix ? (isInc ? Opcode.OP_inc : Opcode.OP_dec) : (isInc ? Opcode.OP_post_inc : Opcode.OP_post_dec))
        if (isPrefix) {
          context.bytecode.emitOp(Opcode.OP_dup)
        }
        context.bytecode.emitOp(Opcode.OP_insert2)
        context.bytecode.emitOp(Opcode.OP_get_var_ref)
        context.bytecode.emitU16(binding.index)
        context.bytecode.emitOp(Opcode.OP_put_private_field)
        return
      }
      this.emitExpression(operand.expression, context)
      const atom = context.getAtom(operand.name.text)
      context.bytecode.emitOp(Opcode.OP_get_field2)
      context.bytecode.emitAtom(atom)
      context.bytecode.emitOp(isPrefix ? (isInc ? Opcode.OP_inc : Opcode.OP_dec) : (isInc ? Opcode.OP_post_inc : Opcode.OP_post_dec))
      if (isPrefix) {
        context.bytecode.emitOp(Opcode.OP_dup)
      }
      context.bytecode.emitOp(Opcode.OP_insert2)
      context.bytecode.emitOp(Opcode.OP_put_field)
      context.bytecode.emitAtom(atom)
      return
    }
    if (ts.isElementAccessExpression(operand)) {
      this.emitExpression(operand.expression, context)
      this.emitExpression(operand.argumentExpression, context)
      context.bytecode.emitOp(Opcode.OP_get_array_el3)
      context.bytecode.emitOp(isPrefix ? (isInc ? Opcode.OP_inc : Opcode.OP_dec) : (isInc ? Opcode.OP_post_inc : Opcode.OP_post_dec))
      if (isPrefix) {
        context.bytecode.emitOp(Opcode.OP_dup)
      }
      context.bytecode.emitOp(Opcode.OP_insert3)
      context.bytecode.emitOp(Opcode.OP_put_array_el)
      return
    }
    throw new Error(`未支持的更新表达式目标: ${ts.SyntaxKind[operand.kind]}`)
  }

  private emitUpdateIdentifier(
    node: ts.Identifier,
    context: EmitterContext,
    isPrefix: boolean,
    isInc: boolean,
  ) {
    const atom = context.getAtom(node.text)
    const scopeLevel = context.scopes.scopeLevel
    if (scopeLevel >= 0) {
      const localIdx = context.scopes.findVarInScope(atom, scopeLevel)
      if (localIdx >= 0) {
        const vd = context.scopes.vars[localIdx]
        context.bytecode.emitOp(vd?.isLexical ? Opcode.OP_get_loc_check : Opcode.OP_get_loc)
        context.bytecode.emitU16(localIdx)
        context.bytecode.emitOp(isPrefix ? (isInc ? Opcode.OP_inc : Opcode.OP_dec) : (isInc ? Opcode.OP_post_inc : Opcode.OP_post_dec))
        if (isPrefix) {
          context.bytecode.emitOp(Opcode.OP_dup)
        }
        context.bytecode.emitOp(vd?.isLexical ? Opcode.OP_put_loc_check : Opcode.OP_put_loc)
        context.bytecode.emitU16(localIdx)
        return
      }
    }

    const argIndex = context.getArgIndex(node.text)
    if (argIndex >= 0) {
      context.bytecode.emitOp(Opcode.OP_get_arg)
      context.bytecode.emitU16(argIndex)
      context.bytecode.emitOp(isPrefix ? (isInc ? Opcode.OP_inc : Opcode.OP_dec) : (isInc ? Opcode.OP_post_inc : Opcode.OP_post_dec))
      if (isPrefix) {
        context.bytecode.emitOp(Opcode.OP_dup)
      }
      context.bytecode.emitOp(Opcode.OP_put_arg)
      context.bytecode.emitU16(argIndex)
      return
    }

    context.bytecode.emitOp(Opcode.OP_get_var)
    context.bytecode.emitAtom(atom)
    context.bytecode.emitOp(isPrefix ? (isInc ? Opcode.OP_inc : Opcode.OP_dec) : (isInc ? Opcode.OP_post_inc : Opcode.OP_post_dec))
    if (isPrefix) {
      context.bytecode.emitOp(Opcode.OP_dup)
    }
    context.bytecode.emitOp(Opcode.OP_put_var)
    context.bytecode.emitAtom(atom)
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
