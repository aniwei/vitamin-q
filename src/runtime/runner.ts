import { QuickJSLib } from '../../scripts/QuickJSLib'

export interface RunResult {
  stdout: string[]
  stderr: string[]
}

/**
 * 字节码运行器（占位实现）。
 *
 * @source QuickJS/src/core/bytecode.cpp:1200-1330
 * @see JS_ReadObject
 */
export const runBytecode = async (bytecode: Uint8Array, modules: string[] = []): Promise<RunResult> => {
  const { stdout, stderr } = await QuickJSLib.withCapturedOutput(async () => {
    await QuickJSLib.runBytes(bytecode, modules)
  })
  return { stdout, stderr }
}
