import type { JSValue } from '../types/bytecode'
import { bcGetLeb128, bcGetU8 } from './bytecode-reader'
import { BcTag } from './value-writer'

/**
 * 值反序列化（占位实现）。
 *
 * @source QuickJS/src/core/bytecode.cpp:820-980
 */
export const JS_ReadObjectRec = (
  reader: { buf: Uint8Array; offset: number },
): JSValue => {
  const tag = bcGetU8(reader)
  switch (tag) {
    case BcTag.Null:
      return null
    case BcTag.True:
      return true
    case BcTag.False:
      return false
    case BcTag.Number: {
      const buffer = new ArrayBuffer(8)
      const view = new DataView(buffer)
      for (let i = 0; i < 8; i += 1) {
        view.setUint8(i, bcGetU8(reader))
      }
      return view.getFloat64(0, true)
    }
    case BcTag.String: {
      const len = bcGetLeb128(reader)
      const bytes = new Uint8Array(len)
      for (let i = 0; i < len; i += 1) {
        bytes[i] = bcGetU8(reader)
      }
      return new TextDecoder().decode(bytes)
    }
    case BcTag.Array: {
      const len = bcGetLeb128(reader)
      const arr: JSValue[] = []
      for (let i = 0; i < len; i += 1) {
        arr.push(JS_ReadObjectRec(reader))
      }
      return arr
    }
    case BcTag.Object: {
      const len = bcGetLeb128(reader)
      const obj: Record<string, JSValue> = {}
      for (let i = 0; i < len; i += 1) {
        const key = JS_ReadObjectRec(reader)
        const value = JS_ReadObjectRec(reader)
        if (typeof key === 'string') obj[key] = value
      }
      return obj
    }
    default:
      return null
  }
}
