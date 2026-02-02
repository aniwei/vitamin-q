import type { BlockEnv } from '../types/function-def'

/**
 * 控制流 BlockEnv 栈管理。
 *
 * @source QuickJS/src/core/parser.c:6348-6365
 * @see push_break_entry
 * @see pop_break_entry
 */
export class BlockManager {
  private top: BlockEnv | null = null

  /**
   * 推入新的 BlockEnv。
   *
   * @source QuickJS/src/core/parser.c:6348-6365
   * @see push_break_entry
   */
  push(entry: BlockEnv): BlockEnv {
    entry.prev = this.top
    this.top = entry
    return entry
  }

  /**
   * 弹出当前 BlockEnv。
   *
   * @source QuickJS/src/core/parser.c:6367-6373
   * @see pop_break_entry
   */
  pop(): BlockEnv | null {
    const current = this.top
    if (!current) return null
    this.top = current.prev
    current.prev = null
    return current
  }

  /**
   * 获取当前 BlockEnv。
   *
   * @source QuickJS/src/core/parser.c:6375-6409
   * @see emit_break
   */
  peek(): BlockEnv | null {
    return this.top
  }

  /**
   * 迭代当前 BlockEnv 链。
   */
  *iterate(): IterableIterator<BlockEnv> {
    let cursor = this.top
    while (cursor) {
      yield cursor
      cursor = cursor.prev
    }
  }
}
