/**
 * 字节码缓冲区接口。
 *
 * @source parser.c: DynBuf 相关用法
 */
export interface BytecodeBuffer {
  buf: Uint8Array
  size: number
  error?: boolean
}

/**
 * 常量池接口。
 *
 * @source parser.c: cpool_add
 */
export interface ConstantPool<T = JSValue> {
  values: T[]
}

/**
 * QuickJS JSValue 表示。
 *
 * @source types.h: JSValue/JS_TAG_*
 */
export type JSValue = {
  tag: number
  value: unknown
}
