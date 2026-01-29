import ts from 'typescript'

export interface SourceLineCol {
  line: number
  column: number
}

export interface SourceRange {
  start: SourceLineCol
  end: SourceLineCol
}

export interface LineColCache {
  source: string
  ptr: number
  line: number
  column: number
}

/**
 * 计算缓冲区区间的行列增量。
 *
 * @source QuickJS/src/core/parser.c:131-170
 * @see get_line_col
 */
export const getLineCol = (source: string, start: number, end: number): SourceLineCol => {
  let line = 0
  let column = 0
  const segment = source.slice(start, end)
  for (const ch of segment) {
    if (ch === '\n') {
      line += 1
      column = 0
    } else {
      column += 1
    }
  }
  return { line, column }
}

/**
 * 创建行列缓存。
 *
 * @source QuickJS/src/core/parser.c:151-193
 * @see get_line_col_cached
 */
export const createLineColCache = (source: string): LineColCache => ({
  source,
  ptr: 0,
  line: 0,
  column: 0,
})

/**
 * 计算指定位置的列偏移（行起点到当前位置）。
 *
 * @source QuickJS/src/core/parser.c:151-193
 * @see get_line_col_cached
 */
const getColumnFromLineStart = (source: string, position: number): number => {
  const lineStart = source.lastIndexOf('\n', position - 1)
  const segment = source.slice(lineStart + 1, position)
  let column = 0
  for (const ch of segment) {
    if (ch === '\n') break
    column += 1
  }
  return column
}

/**
 * 增量计算行列号（等价 get_line_col_cached）。
 *
 * @source QuickJS/src/core/parser.c:151-193
 * @see get_line_col_cached
 */
export const getLineColCached = (cache: LineColCache, position: number): SourceLineCol => {
  if (position >= cache.ptr) {
    const delta = getLineCol(cache.source, cache.ptr, position)
    if (delta.line === 0) {
      cache.column += delta.column
    } else {
      cache.line += delta.line
      cache.column = delta.column
    }
  } else {
    const delta = getLineCol(cache.source, position, cache.ptr)
    if (delta.line === 0) {
      cache.column -= delta.column
    } else {
      cache.line -= delta.line
      cache.column = getColumnFromLineStart(cache.source, position)
    }
  }

  cache.ptr = position
  return { line: cache.line, column: cache.column }
}

/**
 * 获取位置的行列号。
 *
 * @source QuickJS/src/core/parser.c:131-193
 * @see get_line_col
 */
export const getPositionLocation = (
  sourceFile: ts.SourceFile,
  position: number,
  cache?: LineColCache,
): SourceLineCol => {
  if (cache) return getLineColCached(cache, position)
  return getLineCol(sourceFile.text, 0, position)
}

/**
 * 获取节点起止行列范围。
 *
 * @source QuickJS/src/core/parser.c:131-193
 * @see get_line_col
 */
export const getNodeRange = (
  sourceFile: ts.SourceFile,
  node: ts.Node,
  cache?: LineColCache,
): SourceRange => {
  const start = getPositionLocation(sourceFile, node.getStart(sourceFile), cache)
  const end = getPositionLocation(sourceFile, node.getEnd(), cache)
  return { start, end }
}

/**
 * 获取节点起始位置行列。
 *
 * @source QuickJS/src/core/parser.c:131-193
 * @see get_line_col
 */
export const getNodeLocation = (
  sourceFile: ts.SourceFile,
  node: ts.Node,
  cache?: LineColCache,
): SourceLineCol => getPositionLocation(sourceFile, node.getStart(sourceFile), cache)

/**
 * 从诊断信息映射源码位置。
 *
 * @source QuickJS/src/core/parser.c:186-223
 * @see js_parse_error_v
 */
export const getDiagnosticLocation = (
  diagnostic: ts.Diagnostic,
  cache?: LineColCache,
): SourceLineCol | null => {
  if (!diagnostic.file || diagnostic.start == null) return null
  return getPositionLocation(diagnostic.file, diagnostic.start, cache)
}
