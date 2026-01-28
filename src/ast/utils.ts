import ts from 'typescript'

export const isExpression = (node: ts.Node): node is ts.Expression => {
  return ts.isExpression(node)
}

export const isStatement = (node: ts.Node): node is ts.Statement => {
  return ts.isStatement(node)
}

export const isDeclaration = (node: ts.Node): node is ts.Declaration => {
  return ts.isDeclaration(node)
}

export const isFunctionLike = (node: ts.Node): node is ts.FunctionLikeDeclaration => {
  return ts.isFunctionLike(node)
}
