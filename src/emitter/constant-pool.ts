/**
 * 常量池管理。
 *
 * @source parser.c: cpool_add
 */
export class ConstantPool<T> {
  private values: T[] = []
  private indexMap = new Map<string, number>()

  get size(): number {
    return this.values.length
  }

  getAll(): T[] {
    return [...this.values]
  }

  add(value: T): number {
    const key = this.makeKey(value)
    const existing = this.indexMap.get(key)
    if (existing !== undefined) return existing

    const idx = this.values.length
    this.values.push(value)
    this.indexMap.set(key, idx)
    return idx
  }

  private makeKey(value: T): string {
    if (value === null) return 'null'
    const t = typeof value
    if (t === 'string' || t === 'number' || t === 'boolean' || t === 'bigint') {
      return `${t}:${String(value)}`
    }
    return `obj:${JSON.stringify(value)}`
  }
}
