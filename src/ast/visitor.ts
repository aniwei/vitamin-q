import ts from 'typescript'

export interface VisitHandlers {
  enter?: (node: ts.Node, context: VisitorContext) => void
  exit?: (node: ts.Node, context: VisitorContext) => void
}

export interface VisitorContext {
  sourceFile: ts.SourceFile
  stack: ts.Node[]
  depth: number
  getParent: () => ts.Node | undefined
  getAncestors: () => readonly ts.Node[]
}

/**
 * 更新遍历深度。
 *
 * @source QuickJS/src/core/parser.c:6939-7078
 * @see js_parse_statement_or_decl
 */
const updateDepth = (context: VisitorContext) => {
  context.depth = Math.max(0, context.stack.length - 1)
}

/**
 * 创建 AST 遍历上下文。
 *
 * @source QuickJS/src/core/parser.c:6939-7078
 * @see js_parse_statement_or_decl
 */
export const createVisitorContext = (sourceFile: ts.SourceFile): VisitorContext => {
  const stack: ts.Node[] = []
  const context: VisitorContext = {
    sourceFile,
    stack,
    depth: 0,
    getParent: () => stack[stack.length - 2],
    getAncestors: () => stack.slice(0, -1),
  }
  return context
}

/**
 * 深度优先遍历 AST 节点。
 *
 * @source QuickJS/src/core/parser.c:6939-7078
 * @see js_parse_statement_or_decl
 */
export const visitNode = (node: ts.Node, context: VisitorContext, handlers: VisitHandlers) => {
  context.stack.push(node)
  updateDepth(context)
  handlers.enter?.(node, context)

  ts.forEachChild(node, (child) => visitNode(child, context, handlers))

  handlers.exit?.(node, context)
  context.stack.pop()
  updateDepth(context)
}

/**
 * 从 SourceFile 入口开始遍历 AST。
 *
 * @source QuickJS/src/core/parser.c:6939-7078
 * @see js_parse_statement_or_decl
 */
export const traverseSourceFile = (sourceFile: ts.SourceFile, handlers: VisitHandlers) => {
  const context = createVisitorContext(sourceFile)
  visitNode(sourceFile, context, handlers)
}

/**
 * 节点类型守卫：Statement。
 *
 * @source QuickJS/src/core/parser.c:6939-7078
 * @see js_parse_statement_or_decl
 */
export const isStatementNode = (node: ts.Node): node is ts.Statement => ts.isStatement(node)

/**
 * 节点类型守卫：Expression。
 *
 * @source QuickJS/src/core/parser.c:6939-7078
 * @see js_parse_statement_or_decl
 */
export const isExpressionNode = (node: ts.Node): node is ts.Expression => ts.isExpression(node)

/**
 * 节点类型守卫：Declaration。
 *
 * @source QuickJS/src/core/parser.c:6939-7078
 * @see js_parse_statement_or_decl
 */
export const isDeclarationNode = (node: ts.Node): node is ts.Declaration =>
  ts.isClassDeclaration(node) ||
  ts.isFunctionDeclaration(node) ||
  ts.isVariableDeclaration(node) ||
  ts.isInterfaceDeclaration(node) ||
  ts.isTypeAliasDeclaration(node) ||
  ts.isEnumDeclaration(node) ||
  ts.isModuleDeclaration(node) ||
  ts.isImportDeclaration(node) ||
  ts.isImportEqualsDeclaration(node) ||
  ts.isExportDeclaration(node) ||
  ts.isExportAssignment(node) ||
  ts.isNamespaceImport(node) ||
  ts.isNamedImports(node) ||
  ts.isImportSpecifier(node) ||
  ts.isExportSpecifier(node) ||
  ts.isParameter(node) ||
  ts.isPropertyDeclaration(node) ||
  ts.isMethodDeclaration(node) ||
  ts.isGetAccessor(node) ||
  ts.isSetAccessor(node) ||
  ts.isConstructorDeclaration(node) ||
  ts.isTypeParameterDeclaration(node) ||
  ts.isBindingElement(node) ||
  ts.isPropertySignature(node) ||
  ts.isMethodSignature(node) ||
  ts.isCallSignatureDeclaration(node) ||
  ts.isConstructSignatureDeclaration(node) ||
  ts.isIndexSignatureDeclaration(node)

/**
 * 节点类型守卫：NamedDeclaration。
 *
 * @source QuickJS/src/core/parser.c:6939-7078
 * @see js_parse_statement_or_decl
 */
export const isNamedDeclarationNode = (node: ts.Node): node is ts.NamedDeclaration => {
  if (!isDeclarationNode(node)) return false
  return 'name' in node && Boolean((node as { name?: ts.Node }).name)
}
