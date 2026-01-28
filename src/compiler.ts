import ts from 'typescript'
import { parseSource } from './ast/parser'

export interface CompileOptions {
  fileName?: string
  scriptTarget?: ts.ScriptTarget
  scriptKind?: ts.ScriptKind
}

export interface CompileResult {
  sourceFile: ts.SourceFile
  diagnostics: ts.Diagnostic[]
}

/**
 * 编译入口（当前仅完成 AST 解析）。
 *
 * @source parser.c: __JS_EvalInternal
 */
export const compile = (sourceText: string, options: CompileOptions = {}): CompileResult => {
  const sourceFile = parseSource(sourceText, options)
  return {
    sourceFile,
    diagnostics: sourceFile.parseDiagnostics ?? [],
  }
}
