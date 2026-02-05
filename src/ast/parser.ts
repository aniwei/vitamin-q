import ts from 'typescript'

export interface ParseSourceOptions {
  fileName?: string
  languageVersion?: ts.ScriptTarget
  scriptKind?: ts.ScriptKind
  setParentNodes?: boolean
  setExternalModuleIndicator?: (file: ts.SourceFile) => void
}

/**
 * 根据文件名推断 ScriptKind。
 *
 * @source QuickJS/src/core/parser.c:13617-13663
 * @see js_parse_program
 */
const inferScriptKind = (fileName: string): ts.ScriptKind => {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.tsx')) return ts.ScriptKind.TSX
  if (lower.endsWith('.jsx')) return ts.ScriptKind.JSX
  if (lower.endsWith('.ts') || lower.endsWith('.mts') || lower.endsWith('.cts')) return ts.ScriptKind.TS
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}

/**
 * 解析源码为 TypeScript AST。
 *
 * @source QuickJS/src/core/parser.c:13617-13663
 * @see js_parse_program
 */
export const parseSource = (source: string, options: ParseSourceOptions = {}): ts.SourceFile => {
  const {
    fileName = '<eval>',
    languageVersion = ts.ScriptTarget.ES2020,
    scriptKind = inferScriptKind(fileName),
    setParentNodes = true,
    setExternalModuleIndicator,
  } = options

  if (setExternalModuleIndicator) {
    return ts.createSourceFile(
      fileName,
      source,
      { languageVersion, setExternalModuleIndicator },
      setParentNodes,
      scriptKind,
    )
  }

  return ts.createSourceFile(fileName, source, languageVersion, setParentNodes, scriptKind)
}
