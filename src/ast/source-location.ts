export interface LineColCache {
  ptr: number
  line: number
  column: number
}

export interface SourceLocation {
  line: number
  column: number
  offset: number
}

/**
 * 获取指定偏移的行列号（0-based）。
 *
 * @source parser.c: get_line_col
 */
export const getLineCol = (text: string, end: number): SourceLocation => {
  let line = 0
  let column = 0
  for (let i = 0; i < end; i += 1) {
    const c = text.charCodeAt(i)
    if (c === 0x0a) {
      line += 1
      column = 0
    } else {
      column += 1
    }
  }
  return { line, column, offset: end }
}

/**
 * 使用缓存增量计算行列号（0-based）。
 *
 * @source parser.c: get_line_col_cached
 */
export const getLineColCached = (
  cache: LineColCache,
  text: string,
  ptr: number,
): SourceLocation => {
  if (ptr >= cache.ptr) {
    const delta = getLineCol(text.slice(cache.ptr), ptr - cache.ptr)
    if (delta.line === 0) {
      cache.column += delta.column
    } else {
      cache.line += delta.line
      cache.column = delta.column
    }
  } else {
    const delta = getLineCol(text.slice(ptr), cache.ptr - ptr)
    if (delta.line === 0) {
      cache.column -= delta.column
    } else {
      cache.line -= delta.line
      let col = 0
      for (let i = ptr - 1; i >= 0; i -= 1) {
        const c = text.charCodeAt(i)
        if (c === 0x0a) break
        col += 1
      }
      cache.column = col
    }
  }
  cache.ptr = ptr
  return { line: cache.line, column: cache.column, offset: ptr }
}
