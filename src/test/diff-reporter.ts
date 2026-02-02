export interface DiffReport {
  file: string
  match: boolean
  diffIndex?: number
  ours?: number
  wasm?: number
  context?: { offset: number; ours: number[]; wasm: number[] }
}

/**
 * 字节码差异报告（占位实现）。
 *
 * @source QuickJS/src/core/bytecode.cpp:1500-1600
 */
export const formatDiffReport = (
  ours: Uint8Array,
  wasm: Uint8Array,
  file: string,
  diffIndex?: number,
  contextSize = 8,
): DiffReport => {
  if (diffIndex === undefined) {
    return { file, match: true }
  }

  const start = Math.max(0, diffIndex - contextSize)
  const end = Math.max(diffIndex + contextSize + 1, start)
  const oursSlice = Array.from(ours.slice(start, end))
  const wasmSlice = Array.from(wasm.slice(start, end))

  return {
    file,
    match: false,
    diffIndex,
    ours: ours[diffIndex],
    wasm: wasm[diffIndex],
    context: {
      offset: start,
      ours: oursSlice,
      wasm: wasmSlice,
    },
  }
}

export const renderDiffText = (report: DiffReport): string => {
  if (report.match) return `${report.file}: OK`
  const header = `${report.file}: diff at ${report.diffIndex} ours=${report.ours} wasm=${report.wasm}`
  const ctx = report.context
  if (!ctx) return header
  return [
    header,
    `ours@${ctx.offset}: ${ctx.ours.join(' ')}`,
    `wasm@${ctx.offset}: ${ctx.wasm.join(' ')}`,
  ].join('\n')
}
