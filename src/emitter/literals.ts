import ts from 'typescript'

import { COPY_DATA_PROPERTIES_OPERAND_SPREAD, Opcode } from '../env'
import type { EmitterContext } from './emitter'
import type { ExpressionEmitterFn } from './assignment'

/**
 * 字面量发射器（对象/数组）。
 *
 * @source QuickJS/src/core/parser.c:2928-3042
 * @source QuickJS/src/core/parser.c:3760-3885
 * @see js_parse_array_literal
 * @see js_parse_object_literal
 */
export class LiteralEmitter {
  emitArrayLiteral(node: ts.ArrayLiteralExpression, context: EmitterContext, emitExpression: ExpressionEmitterFn) {
    const elements = node.elements
    const hasSpread = elements.some(element => ts.isSpreadElement(element))
    const hasHole = elements.some(element => element.kind === ts.SyntaxKind.OmittedExpression)

    if (!hasSpread && !hasHole) {
      for (const element of elements) {
        emitExpression(element as ts.Expression, context)
      }
      context.bytecode.emitOp(Opcode.OP_array_from)
      context.bytecode.emitU16(elements.length)
      return
    }

    context.bytecode.emitOp(Opcode.OP_array_from)
    context.bytecode.emitU16(0)
    context.bytecode.emitOp(Opcode.OP_push_i32)
    context.bytecode.emitU32(0)

    let needLength = false
    for (const element of elements) {
      if (ts.isSpreadElement(element)) {
        needLength = true
        emitExpression(element.expression, context)
        context.bytecode.emitOp(Opcode.OP_append)
        continue
      }

      if (element.kind === ts.SyntaxKind.OmittedExpression) {
        needLength = true
        context.bytecode.emitOp(Opcode.OP_inc)
        continue
      }

      needLength = true
      emitExpression(element as ts.Expression, context)
      context.bytecode.emitOp(Opcode.OP_define_array_el)
      needLength = false
      context.bytecode.emitOp(Opcode.OP_inc)
    }

    if (needLength) {
      const lengthAtom = context.getAtom('length')
      context.bytecode.emitOp(Opcode.OP_dup1)
      context.bytecode.emitOp(Opcode.OP_put_field)
      context.bytecode.emitAtom(lengthAtom)
      context.bytecode.emitIC(lengthAtom)
    } else {
      context.bytecode.emitOp(Opcode.OP_drop)
    }
  }

  emitObjectLiteral(node: ts.ObjectLiteralExpression, context: EmitterContext, emitExpression: ExpressionEmitterFn) {
    context.bytecode.emitOp(Opcode.OP_object)

    for (const prop of node.properties) {
      if (ts.isPropertyAssignment(prop)) {
        if (ts.isComputedPropertyName(prop.name)) {
          emitExpression(prop.name.expression, context)
          context.bytecode.emitOp(Opcode.OP_to_propkey)
          emitExpression(prop.initializer, context)
          context.bytecode.emitOp(Opcode.OP_define_array_el)
          context.bytecode.emitOp(Opcode.OP_drop)
          continue
        }

        const nameText = this.getPropertyNameText(prop.name)
        if (nameText === '__proto__') {
          emitExpression(prop.initializer, context)
          context.bytecode.emitOp(Opcode.OP_set_proto)
          continue
        }

        emitExpression(prop.initializer, context)
        context.bytecode.emitOp(Opcode.OP_define_field)
        context.bytecode.emitAtom(context.getAtom(nameText))
        continue
      }

      if (ts.isShorthandPropertyAssignment(prop)) {
        const atom = context.getAtom(prop.name.text)
        context.bytecode.emitOp(Opcode.OP_get_var)
        context.bytecode.emitAtom(atom)
        context.bytecode.emitOp(Opcode.OP_define_field)
        context.bytecode.emitAtom(atom)
        continue
      }

      if (ts.isSpreadAssignment(prop)) {
        emitExpression(prop.expression, context)
        context.bytecode.emitOp(Opcode.OP_null)
        context.bytecode.emitOp(Opcode.OP_copy_data_properties)
        context.bytecode.emitU8(COPY_DATA_PROPERTIES_OPERAND_SPREAD)
        context.bytecode.emitOp(Opcode.OP_drop)
        context.bytecode.emitOp(Opcode.OP_drop)
        continue
      }

      throw new Error(`未支持的对象字面量成员: ${ts.SyntaxKind[prop.kind]}`)
    }
  }

  private getPropertyNameText(name: ts.PropertyName): string {
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
      return name.text
    }
    if (ts.isPrivateIdentifier(name)) {
      return name.text
    }
    throw new Error(`未支持的对象属性名: ${ts.SyntaxKind[name.kind]}`)
  }
}
