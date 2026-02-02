import ts from 'typescript'

/**
 * 模块检测（占位实现）。
 *
 * @source QuickJS/src/core/parser.c:13280-13360
 * @see JS_DetectModule
 */
export const detectModule = (sourceFile: ts.SourceFile): boolean => {
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) return true
    if (ts.isExportDeclaration(statement)) return true
    if (ts.isExportAssignment(statement)) return true
  }

  let found = false
  const visit = (node: ts.Node) => {
    if (found) return
    if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) {
      found = true
      return
    }
    ts.forEachChild(node, visit)
  }

  ts.forEachChild(sourceFile, visit)
  return found
}
