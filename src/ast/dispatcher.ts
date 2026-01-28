import ts from 'typescript'

export type ExpressionHandler = (node: ts.Expression) => void
export type StatementHandler = (node: ts.Statement) => void
export type DeclarationHandler = (node: ts.Declaration) => void

export interface Dispatcher {
  expressions: Map<ts.SyntaxKind, ExpressionHandler>
  statements: Map<ts.SyntaxKind, StatementHandler>
  declarations: Map<ts.SyntaxKind, DeclarationHandler>
}

export const createDispatcher = (): Dispatcher => ({
  expressions: new Map(),
  statements: new Map(),
  declarations: new Map(),
})

export const dispatchExpression = (dispatcher: Dispatcher, node: ts.Expression): void => {
  const handler = dispatcher.expressions.get(node.kind)
  if (handler) handler(node)
}

export const dispatchStatement = (dispatcher: Dispatcher, node: ts.Statement): void => {
  const handler = dispatcher.statements.get(node.kind)
  if (handler) handler(node)
}

export const dispatchDeclaration = (dispatcher: Dispatcher, node: ts.Declaration): void => {
  const handler = dispatcher.declarations.get(node.kind)
  if (handler) handler(node)
}
