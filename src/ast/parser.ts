import ts from 'typescript'

export interface ParseOptions {
  fileName?: string
  scriptTarget?: ts.ScriptTarget
  scriptKind?: ts.ScriptKind
}

/**
 * 使用 TypeScript Compiler API 解析源码。
 *
 * @source parser.c: js_parse_init/js_parse_program
 */
export const parseSource = (
  sourceText: string,
  options: ParseOptions = {},
): ts.SourceFile => {
  const fileName = options.fileName ?? 'input.ts'
  const scriptTarget = options.scriptTarget ?? ts.ScriptTarget.ES2020
  const scriptKind = options.scriptKind ?? ts.ScriptKind.TS

  return ts.createSourceFile(fileName, sourceText, scriptTarget, true, scriptKind)
}
