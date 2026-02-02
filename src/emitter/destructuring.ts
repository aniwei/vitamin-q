import ts from 'typescript'

import { COPY_DATA_PROPERTIES_FLAGS_DEPTH0, Opcode } from '../env'
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
  /**
   * @source QuickJS/src/core/parser.c:4272-4590
   * @see js_parse_destructuring_element
   */
  emitBindingPattern(
    pattern: DestructuringTarget,
    initializer: ts.Expression,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
  ) {
    const patternKind = (pattern as ts.Node).kind
    switch (pattern.kind) {
      case ts.SyntaxKind.ObjectBindingPattern:
        return this.emitObjectBinding(pattern as ts.ObjectBindingPattern, initializer, context, emitExpression)
      case ts.SyntaxKind.ArrayBindingPattern:
        return this.emitArrayBinding(pattern as ts.ArrayBindingPattern, initializer, context, emitExpression)
      default:
        throw new Error(`未支持的解构模式: ${ts.SyntaxKind[patternKind]}`)
    }
  }

  /**
   * @source QuickJS/src/core/parser.c:4272-4590
   * @see js_parse_destructuring_element
   */
  emitBindingPatternFromValue(
    pattern: DestructuringTarget,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
  ) {
    const patternKind = (pattern as ts.Node).kind
    switch (pattern.kind) {
      case ts.SyntaxKind.ObjectBindingPattern:
        return this.emitObjectBindingFromValue(pattern as ts.ObjectBindingPattern, context, emitExpression)
      case ts.SyntaxKind.ArrayBindingPattern:
        return this.emitArrayBindingFromValue(pattern as ts.ArrayBindingPattern, context, emitExpression)
      default:
        throw new Error(`未支持的解构模式: ${ts.SyntaxKind[patternKind]}`)
    }
  }

  /**
   * @source QuickJS/src/core/parser.c:4590-4794
   * @see js_parse_destructuring_element
   */
  emitAssignmentPattern(
    pattern: DestructuringAssignmentTarget,
    right: ts.Expression,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
  ) {
    const patternKind = (pattern as ts.Node).kind
    switch (pattern.kind) {
      case ts.SyntaxKind.ObjectLiteralExpression:
        return this.emitObjectAssignment(pattern as ts.ObjectLiteralExpression, right, context, emitExpression)
      case ts.SyntaxKind.ArrayLiteralExpression:
        return this.emitArrayAssignment(pattern as ts.ArrayLiteralExpression, right, context, emitExpression)
      default:
        throw new Error(`未支持的解构赋值模式: ${ts.SyntaxKind[patternKind]}`)
    }
  }

  private emitObjectBinding(
    pattern: ts.ObjectBindingPattern,
    initializer: ts.Expression,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
  ) {
    const { elements, rest } = this.splitObjectBinding(pattern)
    const elementCount = elements.filter(Boolean).length
    const useGetField2 = Boolean(rest || elementCount === 1)
    const assignLabel = context.labels.newLabel()
    const getLabel = context.labels.newLabel()
    const endLabel = context.labels.newLabel()

    context.bytecode.emitOp(Opcode.OP_undefined)
    context.bytecode.emitOp(Opcode.OP_dup)
    context.bytecode.emitOp(Opcode.OP_is_undefined)
    context.labels.emitGoto(Opcode.OP_if_true, getLabel)
    context.labels.emitLabel(assignLabel)

    context.bytecode.emitOp(Opcode.OP_to_object)
    if (rest) {
      context.bytecode.emitOp(Opcode.OP_object)
      context.bytecode.emitOp(Opcode.OP_swap)
    }

    for (const element of elements) {
      if (!element) continue
      const { propAtom, targetAtom } = this.getObjectBindingAtoms(element, context)
      if (rest) {
        context.bytecode.emitOp(Opcode.OP_swap)
        context.bytecode.emitOp(Opcode.OP_null)
        context.bytecode.emitOp(Opcode.OP_define_field)
        context.bytecode.emitAtom(propAtom)
        context.bytecode.emitOp(Opcode.OP_swap)
      }
      if (useGetField2) {
        context.bytecode.emitOp(Opcode.OP_get_field2)
        context.bytecode.emitAtom(propAtom)
      } else {
        context.bytecode.emitOp(Opcode.OP_dup)
        context.bytecode.emitOp(Opcode.OP_get_field)
        context.bytecode.emitAtom(propAtom)
      }
      if (element.initializer) {
        this.emitDefaultInitializer(element.initializer, context, emitExpression)
      }
      this.emitBindingInit(targetAtom, context)
    }

    if (rest) {
      if (!ts.isIdentifier(rest.name)) {
        throw new Error('对象解构 rest 仅支持标识符绑定')
      }
      context.bytecode.emitOp(Opcode.OP_object)
      context.bytecode.emitOp(Opcode.OP_copy_data_properties)
      context.bytecode.emitU8(COPY_DATA_PROPERTIES_FLAGS_DEPTH0)
      this.emitBindingInit(context.getAtom(rest.name.text), context)
    }

    context.bytecode.emitOp(Opcode.OP_drop)
    if (rest) {
      context.bytecode.emitOp(Opcode.OP_drop)
    }
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
    const { elements, rest } = this.splitArrayBinding(pattern)
    const assignLabel = context.labels.newLabel()
    const getLabel = context.labels.newLabel()
    const endLabel = context.labels.newLabel()

    context.bytecode.emitOp(Opcode.OP_undefined)
    context.bytecode.emitOp(Opcode.OP_dup)
    context.bytecode.emitOp(Opcode.OP_is_undefined)
    context.labels.emitGoto(Opcode.OP_if_true, getLabel)
    context.labels.emitLabel(assignLabel)

    context.bytecode.emitOp(Opcode.OP_for_of_start)

    for (const element of elements) {
      if (!element) continue
      if (element.kind === ts.SyntaxKind.OmittedExpression) {
        context.bytecode.emitOp(Opcode.OP_for_of_next)
        context.bytecode.emitU8(0)
        context.bytecode.emitOp(Opcode.OP_drop)
        context.bytecode.emitOp(Opcode.OP_drop)
        continue
      }
      if (!ts.isBindingElement(element) || !ts.isIdentifier(element.name)) {
        throw new Error('数组解构仅支持简单标识符元素')
      }
      const atom = context.getAtom(element.name.text)
      context.bytecode.emitOp(Opcode.OP_for_of_next)
      context.bytecode.emitU8(0)
      context.bytecode.emitOp(Opcode.OP_drop)
      if (element.initializer) {
        this.emitDefaultInitializer(element.initializer, context, emitExpression)
      }
      this.emitBindingInit(atom, context)
    }

    if (rest) {
      if (!ts.isIdentifier(rest.name)) {
        throw new Error('数组解构 rest 仅支持标识符绑定')
      }
      this.emitSpreadArrayFromIterator(context, 0)
      this.emitBindingInit(context.getAtom(rest.name.text), context)
    }

    context.bytecode.emitOp(Opcode.OP_iterator_close)
    context.labels.emitGoto(Opcode.OP_goto, endLabel)

    context.labels.emitLabel(getLabel)
    context.bytecode.emitOp(Opcode.OP_drop)
    emitExpression(initializer, context)
    context.labels.emitGoto(Opcode.OP_goto, assignLabel)

    context.labels.emitLabel(endLabel)
  }

  private emitObjectBindingFromValue(
    pattern: ts.ObjectBindingPattern,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
  ) {
    const { elements, rest } = this.splitObjectBinding(pattern)
    const elementCount = elements.filter(Boolean).length
    const useGetField2 = Boolean(rest || elementCount === 1)
    context.bytecode.emitOp(Opcode.OP_to_object)
    if (rest) {
      context.bytecode.emitOp(Opcode.OP_object)
      context.bytecode.emitOp(Opcode.OP_swap)
    }

    for (const element of elements) {
      if (!element) continue
      const { propAtom, targetAtom } = this.getObjectBindingAtoms(element, context)
      if (rest) {
        context.bytecode.emitOp(Opcode.OP_swap)
        context.bytecode.emitOp(Opcode.OP_null)
        context.bytecode.emitOp(Opcode.OP_define_field)
        context.bytecode.emitAtom(propAtom)
        context.bytecode.emitOp(Opcode.OP_swap)
      }
      if (useGetField2) {
        context.bytecode.emitOp(Opcode.OP_get_field2)
        context.bytecode.emitAtom(propAtom)
      } else {
        context.bytecode.emitOp(Opcode.OP_dup)
        context.bytecode.emitOp(Opcode.OP_get_field)
        context.bytecode.emitAtom(propAtom)
      }
      if (element.initializer) {
        this.emitDefaultInitializer(element.initializer, context, emitExpression)
      }
      this.emitBindingInit(targetAtom, context)
    }

    if (rest) {
      if (!ts.isIdentifier(rest.name)) {
        throw new Error('对象解构 rest 仅支持标识符绑定')
      }
      context.bytecode.emitOp(Opcode.OP_object)
      context.bytecode.emitOp(Opcode.OP_copy_data_properties)
      context.bytecode.emitU8(COPY_DATA_PROPERTIES_FLAGS_DEPTH0)
      this.emitBindingInit(context.getAtom(rest.name.text), context)
    }

    context.bytecode.emitOp(Opcode.OP_drop)
    if (rest) {
      context.bytecode.emitOp(Opcode.OP_drop)
    }
  }

  private emitArrayBindingFromValue(
    pattern: ts.ArrayBindingPattern,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
  ) {
    const { elements, rest } = this.splitArrayBinding(pattern)
    context.bytecode.emitOp(Opcode.OP_for_of_start)

    for (const element of elements) {
      if (!element) continue
      if (element.kind === ts.SyntaxKind.OmittedExpression) {
        context.bytecode.emitOp(Opcode.OP_for_of_next)
        context.bytecode.emitU8(0)
        context.bytecode.emitOp(Opcode.OP_drop)
        context.bytecode.emitOp(Opcode.OP_drop)
        continue
      }
      if (!ts.isBindingElement(element) || !ts.isIdentifier(element.name)) {
        throw new Error('数组解构仅支持简单标识符元素')
      }
      const atom = context.getAtom(element.name.text)
      context.bytecode.emitOp(Opcode.OP_for_of_next)
      context.bytecode.emitU8(0)
      context.bytecode.emitOp(Opcode.OP_drop)
      if (element.initializer) {
        this.emitDefaultInitializer(element.initializer, context, emitExpression)
      }
      this.emitBindingInit(atom, context)
    }

    if (rest) {
      if (!ts.isIdentifier(rest.name)) {
        throw new Error('数组解构 rest 仅支持标识符绑定')
      }
      this.emitSpreadArrayFromIterator(context, 0)
      this.emitBindingInit(context.getAtom(rest.name.text), context)
    }

    context.bytecode.emitOp(Opcode.OP_iterator_close)
  }

  private emitDefaultInitializer(
    initializer: ts.Expression,
    context: EmitterContext,
    emitExpression: ExpressionEmitterFn,
  ) {
    context.bytecode.emitOp(Opcode.OP_dup)
    context.bytecode.emitOp(Opcode.OP_is_undefined)
    const skipLabel = context.labels.emitGoto(Opcode.OP_if_false, -1)
    context.bytecode.emitOp(Opcode.OP_drop)
    emitExpression(initializer, context)
    context.labels.emitLabel(skipLabel)
  }

  private splitObjectBinding(pattern: ts.ObjectBindingPattern) {
    const elements: ts.BindingElement[] = []
    let rest: ts.BindingElement | undefined
    pattern.elements.forEach((element, index) => {
      if (!element) return
      if (element.dotDotDotToken) {
        if (rest) {
          throw new Error('对象解构 rest 仅允许一个元素')
        }
        if (index !== pattern.elements.length - 1) {
          throw new Error('对象解构 rest 必须是最后一个元素')
        }
        rest = element
        return
      }
      elements.push(element)
    })
    return { elements, rest }
  }

  private splitArrayBinding(pattern: ts.ArrayBindingPattern) {
    const elements: Array<ts.ArrayBindingElement> = []
    let rest: ts.BindingElement | undefined
    pattern.elements.forEach((element, index) => {
      if (!element) return
      if (ts.isBindingElement(element) && element.dotDotDotToken) {
        if (rest) {
          throw new Error('数组解构 rest 仅允许一个元素')
        }
        if (index !== pattern.elements.length - 1) {
          throw new Error('数组解构 rest 必须是最后一个元素')
        }
        rest = element
        return
      }
      elements.push(element)
    })
    return { elements, rest }
  }

  private emitSpreadArrayFromIterator(context: EmitterContext, depth: number) {
    const nextLabel = context.labels.newLabel()
    const doneLabel = context.labels.newLabel()

    context.bytecode.emitOp(Opcode.OP_array_from)
    context.bytecode.emitU16(0)
    context.bytecode.emitOp(Opcode.OP_push_i32)
    context.bytecode.emitU32(0)

    context.labels.emitLabel(nextLabel)
    context.bytecode.emitOp(Opcode.OP_for_of_next)
    context.bytecode.emitU8(2 + depth)
    context.labels.emitGoto(Opcode.OP_if_true, doneLabel)
    context.bytecode.emitOp(Opcode.OP_define_array_el)
    context.bytecode.emitOp(Opcode.OP_inc)
    context.labels.emitGoto(Opcode.OP_goto, nextLabel)

    context.labels.emitLabel(doneLabel)
    context.bytecode.emitOp(Opcode.OP_drop)
    context.bytecode.emitOp(Opcode.OP_drop)
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

  private emitBindingInit(atom: number, context: EmitterContext) {
    const scopeLevel = context.scopes.scopeLevel
    if (scopeLevel >= 0) {
      const localIdx = context.scopes.findVarInScope(atom, scopeLevel)
      if (localIdx >= 0) {
        context.bytecode.emitOp(Opcode.OP_put_loc)
        context.bytecode.emitU16(localIdx)
        return
      }
    }
    context.bytecode.emitOp(Opcode.OP_put_var_init)
    context.bytecode.emitAtom(atom)
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
