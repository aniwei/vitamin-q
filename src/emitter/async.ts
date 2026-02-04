import ts from 'typescript'

import { JS_ATOM_NULL, JS_ATOM_return, Opcode } from '../env'
import type { EmitterContext } from './emitter'

export type EmitExpressionFn = (node: ts.Expression, context: EmitterContext) => void

/**
 * 异步发射器。
 *
 * @source QuickJS/src/core/parser.c:9003-9183
 * @see js_parse_expr
 */
export class AsyncEmitter {
  emitAsyncGeneratorYield(
    node: ts.YieldExpression,
    context: EmitterContext,
    emitExpression: EmitExpressionFn,
  ) {
    if (!context.inAsync || !context.inGenerator) {
      throw new Error('async yield 只能出现在异步生成器函数中')
    }

    if (node.expression) {
      emitExpression(node.expression, context)
    } else {
      context.bytecode.emitOp(Opcode.OP_undefined)
    }

    context.bytecode.emitOp(Opcode.OP_await)
    context.bytecode.emitOp(Opcode.OP_yield)
    const resumeLabel = context.labels.newLabel()
    context.labels.emitGoto(Opcode.OP_if_false, resumeLabel)
    emitAsyncGeneratorReturn(context, true)
    context.labels.emitLabel(resumeLabel)
  }

  emitAsyncYieldStar(
    expression: ts.Expression | undefined,
    context: EmitterContext,
    emitExpression: EmitExpressionFn,
  ) {
    if (!expression) {
      context.bytecode.emitOp(Opcode.OP_undefined)
      context.bytecode.emitOp(Opcode.OP_async_yield_star)
      return
    }

    emitExpression(expression, context)
    const doneAtom = context.getAtom('done')
    const valueAtom = context.getAtom('value')

    const loopLabel = context.labels.newLabel()
    const valueLabel = context.labels.newLabel()
    const throwLabel = context.labels.newLabel()
    const call0Label = context.labels.newLabel()
    const returnLabel = context.labels.newLabel()
    const call1Label = context.labels.newLabel()
    const throwErrorLabel = context.labels.newLabel()
    const doneLabel = context.labels.newLabel()

    context.bytecode.emitOp(Opcode.OP_for_await_of_start)
    context.bytecode.emitOp(Opcode.OP_drop)
    context.bytecode.emitOp(Opcode.OP_undefined)
    context.bytecode.emitOp(Opcode.OP_undefined)

    context.labels.emitLabel(loopLabel)
    context.bytecode.emitOp(Opcode.OP_iterator_next)
    context.bytecode.emitOp(Opcode.OP_await)
    context.bytecode.emitOp(Opcode.OP_iterator_check_object)
    context.bytecode.emitOp(Opcode.OP_get_field2)
    context.bytecode.emitAtom(doneAtom)
    context.labels.emitGoto(Opcode.OP_if_true, doneLabel)

    context.labels.emitLabel(valueLabel)
    context.bytecode.emitOp(Opcode.OP_get_field)
    context.bytecode.emitAtom(valueAtom)
    context.bytecode.emitOp(Opcode.OP_await)
    context.bytecode.emitOp(Opcode.OP_async_yield_star)
    context.bytecode.emitOp(Opcode.OP_dup)
    context.labels.emitGoto(Opcode.OP_if_true, throwLabel)
    context.bytecode.emitOp(Opcode.OP_drop)
    context.labels.emitGoto(Opcode.OP_goto, loopLabel)

    context.labels.emitLabel(throwLabel)
    context.bytecode.emitOp(Opcode.OP_push_i32)
    context.bytecode.emitU32(2)
    context.bytecode.emitOp(Opcode.OP_strict_eq)
    context.labels.emitGoto(Opcode.OP_if_true, returnLabel)
    context.bytecode.emitOp(Opcode.OP_await)
    context.bytecode.emitOp(Opcode.OP_iterator_call)
    context.bytecode.emitU8(0)
    context.labels.emitGoto(Opcode.OP_if_true, call0Label)
    context.bytecode.emitOp(Opcode.OP_await)
    context.bytecode.emitOp(Opcode.OP_iterator_check_object)
    context.bytecode.emitOp(Opcode.OP_get_field2)
    context.bytecode.emitAtom(doneAtom)
    context.labels.emitGoto(Opcode.OP_if_false, valueLabel)
    context.bytecode.emitOp(Opcode.OP_get_field)
    context.bytecode.emitAtom(valueAtom)

    context.labels.emitLabel(call0Label)
    context.bytecode.emitOp(Opcode.OP_nip)
    context.bytecode.emitOp(Opcode.OP_nip)
    context.bytecode.emitOp(Opcode.OP_nip)
    context.bytecode.emitOp(Opcode.OP_await)
    context.bytecode.emitOp(Opcode.OP_await)
    context.bytecode.emitOp(Opcode.OP_return_async)

    context.labels.emitLabel(returnLabel)
    context.bytecode.emitOp(Opcode.OP_iterator_call)
    context.bytecode.emitU8(1)
    context.labels.emitGoto(Opcode.OP_if_true, call1Label)
    context.bytecode.emitOp(Opcode.OP_await)
    context.bytecode.emitOp(Opcode.OP_iterator_check_object)
    context.bytecode.emitOp(Opcode.OP_get_field2)
    context.bytecode.emitAtom(doneAtom)
    context.labels.emitGoto(Opcode.OP_if_false, valueLabel)
    context.labels.emitGoto(Opcode.OP_goto, doneLabel)

    context.labels.emitLabel(call1Label)
    context.bytecode.emitOp(Opcode.OP_iterator_call)
    context.bytecode.emitU8(2)
    context.labels.emitGoto(Opcode.OP_if_true, throwErrorLabel)
    context.bytecode.emitOp(Opcode.OP_await)
    context.labels.emitLabel(throwErrorLabel)
    context.bytecode.emitOp(Opcode.OP_throw_error)
    context.bytecode.emitAtom(JS_ATOM_NULL)
    context.bytecode.emitU8(4)

    context.labels.emitLabel(doneLabel)
    context.bytecode.emitOp(Opcode.OP_get_field)
    context.bytecode.emitAtom(valueAtom)
    context.bytecode.emitOp(Opcode.OP_nip)
    context.bytecode.emitOp(Opcode.OP_nip)
    context.bytecode.emitOp(Opcode.OP_nip)
    context.bytecode.emitOp(Opcode.OP_drop)
    context.bytecode.emitOp(Opcode.OP_undefined)
    context.bytecode.emitOp(Opcode.OP_await)
    context.bytecode.emitOp(Opcode.OP_return_async)
  }
}

export const emitAsyncGeneratorReturn = (context: EmitterContext, hasValue: boolean) => {
  if (hasValue) {
    context.bytecode.emitOp(Opcode.OP_await)
  } else {
    context.bytecode.emitOp(Opcode.OP_undefined)
  }

  if (context.hasIterator()) {
    emitAsyncGeneratorIteratorClose(context)
  }

  context.bytecode.emitOp(Opcode.OP_await)
  context.bytecode.emitOp(Opcode.OP_return_async)
}

const emitAsyncGeneratorIteratorClose = (context: EmitterContext) => {
  context.bytecode.emitOp(Opcode.OP_nip_catch)
  context.bytecode.emitOp(Opcode.OP_nip)
  context.bytecode.emitOp(Opcode.OP_swap)
  context.bytecode.emitOp(Opcode.OP_get_field2)
  context.bytecode.emitAtom(JS_ATOM_return)
  context.bytecode.emitIC(JS_ATOM_return)
  context.bytecode.emitOp(Opcode.OP_dup)
  context.bytecode.emitOp(Opcode.OP_is_undefined_or_null)
  const skipCallLabel = context.labels.newLabel()
  const doneLabel = context.labels.newLabel()
  context.labels.emitGoto(Opcode.OP_if_true, skipCallLabel)
  context.bytecode.emitOp(Opcode.OP_call_method)
  context.bytecode.emitU16(0)
  context.bytecode.emitOp(Opcode.OP_iterator_check_object)
  context.bytecode.emitOp(Opcode.OP_await)
  context.labels.emitGoto(Opcode.OP_goto, doneLabel)
  context.labels.emitLabel(skipCallLabel)
  context.bytecode.emitOp(Opcode.OP_drop)
  context.labels.emitLabel(doneLabel)
  context.bytecode.emitOp(Opcode.OP_drop)
}
