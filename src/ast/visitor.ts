import ts from 'typescript'

export interface VisitorContext {
  parentStack: ts.Node[]
}

export type NodeVisitor = (node: ts.Node, ctx: VisitorContext) => void

/**
 * 通用 AST 遍历器。
 *
 * @source parser.c: js_parse_* 递归结构
 */
export const visit = (node: ts.Node, visitor: NodeVisitor, ctx?: VisitorContext): void => {
  const context: VisitorContext = ctx ?? { parentStack: [] }
  visitor(node, context)
  context.parentStack.push(node)
  ts.forEachChild(node, (child) => visit(child, visitor, context))
  context.parentStack.pop()
}
