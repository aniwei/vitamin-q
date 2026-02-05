import fs from 'node:fs'
import ts from 'typescript'

import { parseSource } from './ast/parser'
import { AtomTable } from './atom/atom-table'
import { createFunction } from './compiler/create-function'
import { detectModule } from './module/module-detect'
import { parseModule } from './module/module-parser'

export interface CompileOptions {
  fileName?: string
  module?: boolean
  strict?: boolean
  stripDebug?: boolean
  stripSource?: boolean
  useShortOpcodes?: boolean
  atomTable?: AtomTable
}

export interface CompileResult {
  bytecode: Uint8Array
  function: ReturnType<typeof createFunction>
  module: ReturnType<typeof parseModule> | null
  sourceFile: ts.SourceFile
}

/**
 * 编译入口（占位实现）。
 *
 * @source QuickJS/src/core/runtime.c:3820-3970
 * @see __JS_EvalInternal
 */
export const compile = (source: string, options: CompileOptions = {}): CompileResult => {
  const fileName = options.fileName ?? '<eval>'
  const sourceFile = parseSource(source, { fileName })
  const atomTable = options.atomTable ?? new AtomTable()

  const isModule = options.module ?? detectModule(sourceFile)
  const module = isModule ? parseModule(sourceFile, atomTable) : null

  const fn = createFunction({
    sourceFile,
    atomTable,
    stripDebug: options.stripDebug,
    stripSource: options.stripSource,
    useShortOpcodes: options.useShortOpcodes,
    strict: options.strict,
  })

  return {
    bytecode: fn.byteCode,
    function: fn,
    module,
    sourceFile,
  }
}

/**
 * 编译文件入口。
 *
 * @source QuickJS/src/core/runtime.c:3820-3970
 */
export const compileFile = (filePath: string, options: CompileOptions = {}): CompileResult => {
  const source = fs.readFileSync(filePath, 'utf8')
  return compile(source, { ...options, fileName: filePath })
}
