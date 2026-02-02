import type { ColumnNumberSlot, LineNumberSlot } from '../types/function-def'

export interface SourceMapEntry {
  pc: number
  line: number
  column: number
}

export interface SourcePosEntry {
  pc: number
  sourcePos: number
}

/**
 * 源码映射生成（占位实现）。
 *
 * @source QuickJS/src/core/parser.h:193-201
 */
export class SourceMapState {
  readonly lineNumberSlots: LineNumberSlot[] = []
  readonly columnNumberSlots: ColumnNumberSlot[] = []
  readonly sourcePosEntries: SourcePosEntry[] = []

  addLineNumberSlot(pc: number, sourcePos: number) {
    this.lineNumberSlots.push({ pc, sourcePos })
  }

  addColumnNumberSlot(pc: number, sourcePos: number) {
    this.columnNumberSlots.push({ pc, sourcePos })
  }

  addSourcePos(pc: number, sourcePos: number) {
    this.sourcePosEntries.push({ pc, sourcePos })
  }

  snapshot(): {
    lineNumberSlots: LineNumberSlot[]
    columnNumberSlots: ColumnNumberSlot[]
    sourcePosEntries: SourcePosEntry[]
  } {
    return {
      lineNumberSlots: [...this.lineNumberSlots],
      columnNumberSlots: [...this.columnNumberSlots],
      sourcePosEntries: [...this.sourcePosEntries],
    }
  }
}

/**
 * 将行列号槽合成为 SourceMap 条目（占位实现）。
 *
 * @source QuickJS/src/core/parser.c:11890-12130
 */
export const buildSourceMap = (state: SourceMapState): SourceMapEntry[] => {
  const lineMap = new Map(state.lineNumberSlots.map(slot => [slot.pc, slot.sourcePos]))
  const columnMap = new Map(state.columnNumberSlots.map(slot => [slot.pc, slot.sourcePos]))
  const pcs = new Set<number>([
    ...state.lineNumberSlots.map(slot => slot.pc),
    ...state.columnNumberSlots.map(slot => slot.pc),
  ])

  return [...pcs]
    .sort((a, b) => a - b)
    .map(pc => ({
      pc,
      line: lineMap.get(pc) ?? 0,
      column: columnMap.get(pc) ?? 0,
    }))
}
