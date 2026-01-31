import ts from 'typescript'

import { Opcode } from '../env'
import type { EmitterContext } from './emitter'
import type { ExpressionEmitterFn } from './assignment'

export type DestructuringTarget = ts.ObjectBindingPattern | ts.ArrayBindingPattern
export type DestructuringAssignmentTarget = ts.ObjectLiteralExpression | ts.ArrayLiteralExpression

/**
 * 解构赋值发射器。
 *
 * @source QuickJS/src/core/parser.c:4272-4794
 * @see js_parse_destructuring_element
 */
export class DestructuringEmitter {
  emitBindingPattern(
    pattern: DestructuringTarget,
    initializer: ts.Expression,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
  ) {
    if (ts.isObjectBindingPattern(pattern)) {
      this.emitObjectBinding(pattern, initializer, context, emitExpression)
      return
    }

    if (ts.isArrayBindingPattern(pattern)) {
      this.emitArrayBinding(pattern, initializer, context, emitExpression)
      return
    }

    throw new Error(`未支持的解构模式: ${ts.SyntaxKind[pattern.kind]}`)
  }

  emitAssignmentPattern(
    pattern: DestructuringAssignmentTarget,
    right: ts.Expression,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
  ) {
    if (ts.isObjectLiteralExpression(pattern)) {
      this.emitObjectAssignment(pattern, right, context, emitExpression)
      return
    }

    if (ts.isArrayLiteralExpression(pattern)) {
      this.emitArrayAssignment(pattern, right, context, emitExpression)
      return
    }

    throw new Error(`未支持的解构赋值模式: ${ts.SyntaxKind[pattern.kind]}`)
  }

  private emitObjectBinding(
    pattern: ts.ObjectBindingPattern,
    initializer: ts.Expression,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
  ) {
    const assignLabel = context.labels.newLabel()
    const getLabel = context.labels.newLabel()
    const endLabel = context.labels.newLabel()

    context.bytecode.emitOp(Opcode.OP_undefined)
    context.bytecode.emitOp(Opcode.OP_dup)
    context.bytecode.emitOp(Opcode.OP_is_undefined)
    context.labels.emitGoto(Opcode.OP_if_true, getLabel)
    context.labels.emitLabel(assignLabel)

    context.bytecode.emitOp(Opcode.OP_to_object)

    for (const element of pattern.elements) {
      if (!element) continue
      const { propAtom, targetAtom } = this.getObjectBindingAtoms(element, context)
      context.bytecode.emitOp(Opcode.OP_get_field2)
      context.bytecode.emitAtom(propAtom)
      context.bytecode.emitIC(propAtom)
      context.bytecode.emitOp(Opcode.OP_put_var_init)
      context.bytecode.emitAtom(targetAtom)
    }

    context.bytecode.emitOp(Opcode.OP_drop)
    context.labels.emitGoto(Opcode.OP_goto, endLabel)

    context.labels.emitLabel(getLabel)
    context.bytecode.emitOp(Opcode.OP_drop)
    emitExpression(initializer, context)
    context.labels.emitGoto(Opcode.OP_goto, assignLabel)

    context.labels.emitLabel(endLabel)
  }

  private emitArrayBinding(
    pattern: ts.ArrayBindingPattern,
    initializer: ts.Expression,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
  ) {
    const assignLabel = context.labels.newLabel()
    const getLabel = context.labels.newLabel()
    const endLabel = context.labels.newLabel()

    context.bytecode.emitOp(Opcode.OP_undefined)
    context.bytecode.emitOp(Opcode.OP_dup)
    context.bytecode.emitOp(Opcode.OP_is_undefined)
    context.labels.emitGoto(Opcode.OP_if_true, getLabel)
    context.labels.emitLabel(assignLabel)

    context.bytecode.emitOp(Opcode.OP_for_of_start)

    for (const element of pattern.elements) {
      if (!element) continue
      if (!ts.isBindingElement(element) || !ts.isIdentifier(element.name)) {
        throw new Error('数组解构仅支持简单标识符元素')
      }
      const atom = context.getAtom(element.name.text)
      context.bytecode.emitOp(Opcode.OP_for_of_next)
      context.bytecode.emitU8(0)
      context.bytecode.emitOp(Opcode.OP_drop)
      context.bytecode.emitOp(Opcode.OP_put_var_init)
      context.bytecode.emitAtom(atom)
    }

    context.bytecode.emitOp(Opcode.OP_iterator_close)
    context.labels.emitGoto(Opcode.OP_goto, endLabel)

    context.labels.emitLabel(getLabel)
    context.bytecode.emitOp(Opcode.OP_drop)
    emitExpression(initializer, context)
    context.labels.emitGoto(Opcode.OP_goto, assignLabel)

    context.labels.emitLabel(endLabel)
  }

  private emitObjectAssignment(
    pattern: ts.ObjectLiteralExpression,
    right: ts.Expression,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
  ) {
    const assignLabel = context.labels.newLabel()
    const getLabel = context.labels.newLabel()
    const endLabel = context.labels.newLabel()

    context.labels.emitGoto(Opcode.OP_goto, getLabel)
    context.labels.emitLabel(assignLabel)

    context.bytecode.emitOp(Opcode.OP_dup)
    context.bytecode.emitOp(Opcode.OP_to_object)

    for (const prop of pattern.properties) {
      const { propAtom, targetAtom } = this.getObjectLiteralAtoms(prop, context)
      context.bytecode.emitOp(Opcode.OP_dup)
      context.bytecode.emitOp(Opcode.OP_make_var_ref)
      context.bytecode.emitAtom(targetAtom)
      context.bytecode.emitOp(Opcode.OP_rot3l)
      context.bytecode.emitOp(Opcode.OP_get_field)
      context.bytecode.emitAtom(propAtom)
      context.bytecode.emitOp(Opcode.OP_put_ref_value)
    }

    context.bytecode.emitOp(Opcode.OP_drop)
    context.labels.emitGoto(Opcode.OP_goto, endLabel)

    context.labels.emitLabel(getLabel)
    emitExpression(right, context)
    context.labels.emitGoto(Opcode.OP_goto, assignLabel)

    context.labels.emitLabel(endLabel)
  }

  private emitArrayAssignment(
    pattern: ts.ArrayLiteralExpression,
    right: ts.Expression,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
  ) {
    const assignLabel = context.labels.newLabel()
    const getLabel = context.labels.newLabel()
    const endLabel = context.labels.newLabel()

    context.labels.emitGoto(Opcode.OP_goto, getLabel)
    context.labels.emitLabel(assignLabel)

    context.bytecode.emitOp(Opcode.OP_dup)
    context.bytecode.emitOp(Opcode.OP_for_of_start)

    for (const element of pattern.elements) {
      if (ts.isOmittedExpression(element)) {
        continue
      }
      if (!ts.isIdentifier(element)) {
        throw new Error('数组解构赋值仅支持简单标识符元素')
      }
      const atom = context.getAtom(element.text)
      context.bytecode.emitOp(Opcode.OP_make_var_ref)
      context.bytecode.emitAtom(atom)
      context.bytecode.emitOp(Opcode.OP_for_of_next)
      context.bytecode.emitU8(2)
      context.bytecode.emitOp(Opcode.OP_drop)
      context.bytecode.emitOp(Opcode.OP_put_ref_value)
    }

    context.bytecode.emitOp(Opcode.OP_iterator_close)
    context.labels.emitGoto(Opcode.OP_goto, endLabel)

    context.labels.emitLabel(getLabel)
    emitExpression(right, context)
    context.labels.emitGoto(Opcode.OP_goto, assignLabel)

    context.labels.emitLabel(endLabel)
  }

  private getObjectBindingAtoms(
    element: ts.BindingElement,
    context: EmitterContext,
  ): { propAtom: number; targetAtom: number } {
    if (!ts.isIdentifier(element.name)) {
      throw new Error('对象解构仅支持简单标识符元素')
    }

    if (!element.propertyName) {
      const atom = context.getAtom(element.name.text)
      return { propAtom: atom, targetAtom: atom }
    }

    if (ts.isIdentifier(element.propertyName)) {
      return {
        propAtom: context.getAtom(element.propertyName.text),
        targetAtom: context.getAtom(element.name.text),
      }
    }

    throw new Error('对象解构仅支持标识符属性名')
  }

  private getObjectLiteralAtoms(
    prop: ts.ObjectLiteralElementLike,
    context: EmitterContext,
  ): { propAtom: number; targetAtom: number } {
    if (ts.isPropertyAssignment(prop)) {
      if (!ts.isIdentifier(prop.name) || !ts.isIdentifier(prop.initializer)) {
        throw new Error('对象解构赋值仅支持标识符属性与标识符目标')
      }
      return {
        propAtom: context.getAtom(prop.name.text),
        targetAtom: context.getAtom(prop.initializer.text),
      }
    }

    if (ts.isShorthandPropertyAssignment(prop)) {
      const atom = context.getAtom(prop.name.text)
      return { propAtom: atom, targetAtom: atom }
    }

    throw new Error('对象解构赋值仅支持简单属性')
  }
}
