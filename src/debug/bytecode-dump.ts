import { Config } from '../config/env'

export interface DumpOptions {
  maxBytes?: number
  force?: boolean
}

/**
 * 字节码转储（占位实现）。
 *
 * @source QuickJS/src/core/parser.c:12130-12380
 */
export const dumpBytecode = (bytecode: Uint8Array, options: DumpOptions = {}): string => {
  if (!Config.DUMP_BYTECODE && !options.force) return ''
  const max = options.maxBytes ?? bytecode.length
  const slice = bytecode.slice(0, max)
  return Array.from(slice)
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ')
}
