export interface CompilerConfig {
  DEBUG: boolean
  DUMP_BYTECODE: boolean
  DUMP_ATOMS: boolean
  DUMP_CLOSURE: boolean
  DUMP_SOURCE: boolean
  DUMP_READ_OBJECT: boolean
}

const truthy = new Set(['1', 'true', 'yes', 'on'])

const readBool = (value: string | undefined): boolean => {
  if (!value) return false
  return truthy.has(value.toLowerCase())
}

/**
 * 模拟 QuickJS 宏开关。
 *
 * @source quickjs.c: #ifdef DEBUG / DUMP_* 相关宏
 */
export const Config: CompilerConfig = {
  DEBUG: readBool(process.env.DEBUG),
  DUMP_BYTECODE: readBool(process.env.DUMP_BYTECODE),
  DUMP_ATOMS: readBool(process.env.DUMP_ATOMS),
  DUMP_CLOSURE: readBool(process.env.DUMP_CLOSURE),
  DUMP_SOURCE: readBool(process.env.DUMP_SOURCE),
  DUMP_READ_OBJECT: readBool(process.env.DUMP_READ_OBJECT),
}
