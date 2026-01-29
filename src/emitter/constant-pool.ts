import type { JSValue } from '../types/bytecode'

const makePrimitiveKey = (value: JSValue): string => {
  const raw = value as any
  const type = typeof raw
  if (type === 'number') {
    if (Number.isNaN(raw)) return 'number:NaN'
    if (Object.is(raw, -0)) return 'number:-0'
    return `number:${raw}`
  }
  if (type === 'string') return `string:${raw}`
  if (type === 'boolean') return `boolean:${raw}`
  if (type === 'bigint') return `bigint:${raw.toString()}`
  if (type === 'undefined') return 'undefined'
  if (raw === null) return 'null'
  return `other:${String(raw)}`
}

/**
 * 常量池管理（对应 cpool_add 逻辑）。
 *
 * @source QuickJS/src/core/parser.c:1888-1905
 * @see cpool_add
 */
export class ConstantPoolManager {
  private pool: JSValue[] = []
  private primitiveIndex = new Map<string, number>()
  private objectIndex = new WeakMap<object, number>()

  /**
   * 添加常量并返回索引，带去重。
   *
   * @source QuickJS/src/core/parser.c:1888-1905
   * @see cpool_add
   */
  add(value: JSValue): number {
    const existing = this.findIndex(value)
    if (existing !== undefined) return existing

    const index = this.pool.length
    this.pool.push(value)
    this.storeIndex(value, index)
    return index
  }

  /**
   * 读取常量池中的值。
   *
   * @source QuickJS/src/core/parser.c:1888-1905
   * @see cpool_add
   */
  get(index: number): JSValue | undefined {
    return this.pool[index]
  }

  /**
   * 常量池数量。
   *
   * @source QuickJS/src/core/parser.c:1888-1905
   * @see cpool_add
   */
  get size() {
    return this.pool.length
  }

  /**
   * 获取常量池快照。
   *
   * @source QuickJS/src/core/parser.c:1888-1905
   * @see cpool_add
   */
  toArray(): JSValue[] {
    return [...this.pool]
  }

  private findIndex(value: JSValue): number | undefined {
    if (value && (typeof value === 'object' || typeof value === 'function')) {
      return this.objectIndex.get(value as object)
    }
    return this.primitiveIndex.get(makePrimitiveKey(value))
  }

  private storeIndex(value: JSValue, index: number) {
    if (value && (typeof value === 'object' || typeof value === 'function')) {
      this.objectIndex.set(value as object, index)
    } else {
      this.primitiveIndex.set(makePrimitiveKey(value), index)
    }
  }
}
