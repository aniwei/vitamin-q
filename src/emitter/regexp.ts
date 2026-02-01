import { Opcode } from '../env'
import type { EmitterContext } from './emitter'

export interface ParsedRegexp {
  body: string
  flags: string
}

const parseRegexLiteral = (text: string): ParsedRegexp => {
  if (!text.startsWith('/')) {
    throw new Error('无效的正则字面量')
  }

  let inClass = false
  let escaped = false
  let end = -1

  for (let i = 1; i < text.length; i += 1) {
    const ch = text[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\') {
      escaped = true
      continue
    }
    if (ch === '[') {
      inClass = true
      continue
    }
    if (ch === ']' && inClass) {
      inClass = false
      continue
    }
    if (ch === '/' && !inClass) {
      end = i
      break
    }
  }

  if (end < 0) {
    throw new Error('未找到正则字面量结束符')
  }

  return {
    body: text.slice(1, end),
    flags: text.slice(end + 1),
  }
}

const emitPushConst = (context: EmitterContext, value: unknown) => {
  const index = context.constantPool.add(value)
  context.bytecode.emitOp(Opcode.OP_push_const)
  context.bytecode.emitU32(index)
}

/**
 * 正则字面量发射。
 *
 * @source QuickJS/src/core/parser.c:467-571
 * @see js_parse_regexp
 */
export const emitRegexpLiteral = (text: string, context: EmitterContext) => {
  const { body, flags } = parseRegexLiteral(text)
  emitPushConst(context, body)
  emitPushConst(context, flags)
  context.bytecode.emitOp(Opcode.OP_regexp)
}
