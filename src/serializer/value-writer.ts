import type { JSValue } from '../types/bytecode'
import { bcPutLeb128, bcPutU8 } from './bytecode-writer'

export enum BcTag {
  Null = 0,
  True = 1,
  False = 2,
  Number = 3,
  String = 4,
  Array = 5,
  Object = 6,
}

export interface WriteObjectOptions {
  allowReference?: boolean
}

/**
 * 值序列化（占位实现）。
 *
 * @source QuickJS/src/core/bytecode.cpp:620-820
 */
export const JS_WriteObjectRec = (
  writer: { buf: number[] },
  value: JSValue,
  options: WriteObjectOptions = {},
  objectList = new Map<object, number>(),
) => {
  if (value === null || value === undefined) {
    bcPutU8(writer, BcTag.Null)
    return
  }

  if (value === true) {
    bcPutU8(writer, BcTag.True)
    return
  }

  if (value === false) {
    bcPutU8(writer, BcTag.False)
    return
  }

  if (typeof value === 'number') {
    bcPutU8(writer, BcTag.Number)
    const buffer = new ArrayBuffer(8)
    new DataView(buffer).setFloat64(0, value, true)
    const bytes = new Uint8Array(buffer)
    for (const byte of bytes) bcPutU8(writer, byte)
    return
  }

  if (typeof value === 'string') {
    bcPutU8(writer, BcTag.String)
    const encoded = new TextEncoder().encode(value)
    bcPutLeb128(writer, encoded.length)
    for (const byte of encoded) bcPutU8(writer, byte)
    return
  }

  if (Array.isArray(value)) {
    bcPutU8(writer, BcTag.Array)
    bcPutLeb128(writer, value.length)
    for (const item of value) {
      JS_WriteObjectRec(writer, item, options, objectList)
    }
    return
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, JSValue>
    if (options.allowReference) {
      if (objectList.has(obj)) {
        bcPutU8(writer, BcTag.Null)
        return
      }
      objectList.set(obj, objectList.size)
    }
    bcPutU8(writer, BcTag.Object)
    const entries = Object.entries(obj)
    bcPutLeb128(writer, entries.length)
    for (const [key, entry] of entries) {
      JS_WriteObjectRec(writer, key)
      JS_WriteObjectRec(writer, entry, options, objectList)
    }
  }
}
