import ts from 'typescript'

import {
  COPY_DATA_PROPERTIES_OPERAND_SPREAD,
  OP_DEFINE_METHOD_ENUMERABLE,
  OP_DEFINE_METHOD_GETTER,
  OP_DEFINE_METHOD_METHOD,
  OP_DEFINE_METHOD_SETTER,
  Opcode,
} from '../env'
import type { EmitterContext } from './emitter'
import type { ExpressionEmitterFn } from './assignment'
import { FunctionEmitter } from './functions'

/**
 * 字面量发射器（对象/数组）。
 *
 * @source QuickJS/src/core/parser.c:2928-3042
 * @source QuickJS/src/core/parser.c:3760-3885
 * @see js_parse_array_literal
 * @see js_parse_object_literal
 */
export class LiteralEmitter {
  private functionEmitter = new FunctionEmitter()

  /**
   * @source QuickJS/src/core/parser.c:2928-3042
   * @see js_parse_array_literal
   */
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

    if (hasSpread) {
      let prefixCount = 0
      while (prefixCount < elements.length) {
        const element = elements[prefixCount]
        if (ts.isSpreadElement(element) || element.kind === ts.SyntaxKind.OmittedExpression) {
          break
        }
        prefixCount += 1
      }

      if (prefixCount > 0) {
        for (let i = 0; i < prefixCount; i += 1) {
          emitExpression(elements[i] as ts.Expression, context)
        }
        context.bytecode.emitOp(Opcode.OP_array_from)
        context.bytecode.emitU16(prefixCount)
      } else {
        context.bytecode.emitOp(Opcode.OP_array_from)
        context.bytecode.emitU16(0)
      }

      context.bytecode.emitOp(Opcode.OP_push_i32)
      context.bytecode.emitU32(prefixCount)

      let trailingHole = false
      for (let i = prefixCount; i < elements.length; i += 1) {
        const element = elements[i]
        if (ts.isSpreadElement(element)) {
          trailingHole = false
          emitExpression(element.expression, context)
          context.bytecode.emitOp(Opcode.OP_append)
          continue
        }

        if (element.kind === ts.SyntaxKind.OmittedExpression) {
          trailingHole = true
          context.bytecode.emitOp(Opcode.OP_inc)
          continue
        }

        trailingHole = false
        emitExpression(element as ts.Expression, context)
        context.bytecode.emitOp(Opcode.OP_define_array_el)
        context.bytecode.emitOp(Opcode.OP_inc)
      }

      if (trailingHole) {
        const lengthAtom = context.getAtom('length')
        context.bytecode.emitOp(Opcode.OP_dup1)
        context.bytecode.emitOp(Opcode.OP_put_field)
        context.bytecode.emitAtom(lengthAtom)
        context.bytecode.emitIC(lengthAtom)
      } else {
        context.bytecode.emitOp(Opcode.OP_drop)
      }
      return
    }

    context.bytecode.emitOp(Opcode.OP_array_from)
    context.bytecode.emitU16(0)
    context.bytecode.emitOp(Opcode.OP_push_i32)
    context.bytecode.emitU32(0)

    let trailingHole = false
    for (const element of elements) {
      if (element.kind === ts.SyntaxKind.OmittedExpression) {
        trailingHole = true
        context.bytecode.emitOp(Opcode.OP_inc)
        continue
      }

      trailingHole = false
      emitExpression(element as ts.Expression, context)
      context.bytecode.emitOp(Opcode.OP_define_array_el)
      context.bytecode.emitOp(Opcode.OP_inc)
    }

    if (trailingHole) {
      const lengthAtom = context.getAtom('length')
      context.bytecode.emitOp(Opcode.OP_dup1)
      context.bytecode.emitOp(Opcode.OP_put_field)
      context.bytecode.emitAtom(lengthAtom)
      context.bytecode.emitIC(lengthAtom)
    } else {
      context.bytecode.emitOp(Opcode.OP_drop)
    }
  }

  /**
   * @source QuickJS/src/core/parser.c:3760-3885
   * @see js_parse_object_literal
   */
  emitObjectLiteral(node: ts.ObjectLiteralExpression, context: EmitterContext, emitExpression: ExpressionEmitterFn) {
    context.bytecode.emitOp(Opcode.OP_object)

    for (const prop of node.properties) {
      if (ts.isMethodDeclaration(prop) || ts.isGetAccessorDeclaration(prop) || ts.isSetAccessorDeclaration(prop)) {
        const isComputed = ts.isComputedPropertyName(prop.name)
        const opFlags = ts.isGetAccessorDeclaration(prop)
          ? OP_DEFINE_METHOD_GETTER
          : ts.isSetAccessorDeclaration(prop)
              ? OP_DEFINE_METHOD_SETTER
              : OP_DEFINE_METHOD_METHOD

        if (isComputed) {
          emitExpression((prop.name as ts.ComputedPropertyName).expression, context)
          context.bytecode.emitOp(Opcode.OP_to_propkey)
        }

        this.functionEmitter.emitFunctionClosure(prop, context)

        if (isComputed) {
          context.bytecode.emitOp(Opcode.OP_define_method_computed)
        } else {
          context.bytecode.emitOp(Opcode.OP_define_method)
          context.bytecode.emitAtom(context.getAtom(this.getPropertyNameText(prop.name)))
        }
        context.bytecode.emitU8(opFlags | OP_DEFINE_METHOD_ENUMERABLE)
        continue
      }

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
        if (
          (ts.isFunctionExpression(prop.initializer) && !prop.initializer.name) ||
          ts.isArrowFunction(prop.initializer)
        ) {
          context.bytecode.emitOp(Opcode.OP_set_name)
          context.bytecode.emitAtom(context.getAtom(nameText))
        }
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

      const propKind = (prop as ts.Node).kind
      throw new Error(`未支持的对象字面量成员: ${ts.SyntaxKind[propKind]}`)
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
