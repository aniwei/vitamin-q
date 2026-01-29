/**
 * 环境变量配置 - 模拟 C 宏开关。
 *
 * @source QuickJS/src/core/parser.c (DEBUG/DUMP_* 宏条件编译)
 */
export const Config = {
  /** 启用调试模式 - 对应 C: #ifdef DEBUG */
  DEBUG: process.env.DEBUG === 'true' || process.env.DEBUG === '1',
  /** 输出字节码 - 对应 C: #ifdef DUMP_BYTECODE */
  DUMP_BYTECODE: process.env.DUMP_BYTECODE === 'true' || process.env.DUMP_BYTECODE === '1',
  /** 输出原子表 - 对应 C: #ifdef DUMP_ATOMS */
  DUMP_ATOMS: process.env.DUMP_ATOMS === 'true' || process.env.DUMP_ATOMS === '1',
  /** 输出读取对象 - 对应 C: #ifdef DUMP_READ_OBJECT */
  DUMP_READ_OBJECT: process.env.DUMP_READ_OBJECT === 'true' || process.env.DUMP_READ_OBJECT === '1',
  /** 输出内存统计 - 对应 C: #ifdef DUMP_MEM */
  DUMP_MEM: process.env.DUMP_MEM === 'true' || process.env.DUMP_MEM === '1',
  /** 输出闭包变量 - 对应 C: #ifdef DUMP_CLOSURE */
  DUMP_CLOSURE: process.env.DUMP_CLOSURE === 'true' || process.env.DUMP_CLOSURE === '1',
  /** 输出源码映射 - 对应 C: #ifdef DUMP_SOURCE */
  DUMP_SOURCE: process.env.DUMP_SOURCE === 'true' || process.env.DUMP_SOURCE === '1',
} as const
