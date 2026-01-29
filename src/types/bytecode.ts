/**
 * JSValue 表示（占位类型）。
 *
 * @source QuickJS/src/core/types.h:1-120
 */
export type JSValue = unknown

/**
 * 常量池表示。
 *
 * @source QuickJS/src/core/parser.h:260-275
 */
export type ConstantPool = JSValue[]

/**
 * 字节码缓冲区表示（对应 DynBuf）。
 *
 * @source QuickJS/src/core/cutils.h:1-120
 */
export interface BytecodeBuffer {
  buf: Uint8Array
  size: number
  capacity: number
}
