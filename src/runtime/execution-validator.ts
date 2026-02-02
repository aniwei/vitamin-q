import { runBytecode } from './runner'

export interface ExecutionDiff {
  match: boolean
  stdoutDiff?: string
  stderrDiff?: string
}

/**
 * 运行时验证（占位实现）。
 *
 * @source QuickJS/src/core/bytecode.cpp:1400-1500
 */
export const validateExecution = async (
  tsBytecode: Uint8Array,
  wasmBytecode: Uint8Array,
): Promise<ExecutionDiff> => {
  const tsRun = await runBytecode(tsBytecode)
  const wasmRun = await runBytecode(wasmBytecode)

  const tsOut = tsRun.stdout.join('\n')
  const wasmOut = wasmRun.stdout.join('\n')
  const tsErr = tsRun.stderr.join('\n')
  const wasmErr = wasmRun.stderr.join('\n')

  if (tsOut !== wasmOut || tsErr !== wasmErr) {
    return { match: false, stdoutDiff: tsOut !== wasmOut ? `${tsOut} !== ${wasmOut}` : undefined, stderrDiff: tsErr !== wasmErr ? `${tsErr} !== ${wasmErr}` : undefined }
  }

  return { match: true }
}
