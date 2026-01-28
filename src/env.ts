// 本文件由 scripts/getEnv.ts 自动生成
// 请勿手工编辑。
// 生成时间: 1970-01-01T00:00:00.000Z

export const ARGUMENT_VAR_OFFSET = 0
export const SHORT_OPCODES = false

export interface OpcodeDefinition {
  id: string
  size: number
  nPop: number
  nPush: number
  format: number
}

export const OPCODE_BY_CODE: Record<number, OpcodeDefinition> = {}
export const TEMP_OPCODE_BY_CODE: Record<number, OpcodeDefinition> = {}
