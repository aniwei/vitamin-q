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
  text: string
  bytes: Uint8Array
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
const encoder = new TextEncoder()

const isUtf8Lead = (byte: number): boolean => byte < 0x80 || byte >= 0xc0

export const getLineCol = (source: string, start: number, end: number): SourceLineCol => {
  const bytes = encoder.encode(source)
  return getLineColFromBytes(bytes, start, end)
}

const getLineColFromBytes = (bytes: Uint8Array, start: number, end: number): SourceLineCol => {
  let line = 0
  let column = 0
  const limit = Math.min(end, bytes.length)
  for (let i = Math.max(0, start); i < limit; i += 1) {
    const c = bytes[i]
    if (c === 0x0a) {
      line += 1
      column = 0
    } else if (isUtf8Lead(c)) {
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
export const createLineColCache = (text: string): LineColCache => ({
  text,
  bytes: encoder.encode(text),
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
const getColumnFromLineStart = (bytes: Uint8Array, position: number): number => {
  let column = 0
  for (let i = Math.min(position - 1, bytes.length - 1); i >= 0; i -= 1) {
    const c = bytes[i]
    if (c === 0x0a) break
    if (isUtf8Lead(c)) column += 1
  }
  return column
}

/**
 * 将 UTF-16 位置转换为 UTF-8 字节偏移。
 *
 * @source QuickJS/src/core/parser.c:131-193
 * @see get_line_col
 */
export const getByteOffset = (source: string, position: number): number =>
  encoder.encode(source.slice(0, position)).length

/**
 * 增量计算行列号（等价 get_line_col_cached）。
 *
 * @source QuickJS/src/core/parser.c:151-193
 * @see get_line_col_cached
 */
export const getLineColCached = (cache: LineColCache, position: number): SourceLineCol => {
  const bytePos = Math.min(position, cache.bytes.length)
  if (bytePos >= cache.ptr) {
    const delta = getLineColFromBytes(cache.bytes, cache.ptr, bytePos)
    if (delta.line === 0) {
      cache.column += delta.column
    } else {
      cache.line += delta.line
      cache.column = delta.column
    }
  } else {
    const delta = getLineColFromBytes(cache.bytes, bytePos, cache.ptr)
    if (delta.line === 0) {
      cache.column -= delta.column
    } else {
      cache.line -= delta.line
      cache.column = getColumnFromLineStart(cache.bytes, bytePos)
    }
  }

  cache.ptr = bytePos
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
  const bytePos = getByteOffset(sourceFile.text, position)
  if (cache) return getLineColCached(cache, bytePos)
  return getLineCol(sourceFile.text, 0, bytePos)
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
