import ts from 'typescript'

/**
 * 判断节点是否为字面量表达式。
 *
 * @source QuickJS/src/core/parser.c:6331-6482
 * @see js_parse_expr
 */
export const isLiteralExpression = (node: ts.Node): node is ts.LiteralExpression =>
  ts.isStringLiteral(node) ||
  ts.isNumericLiteral(node) ||
  ts.isBigIntLiteral(node) ||
  ts.isNoSubstitutionTemplateLiteral(node) ||
  ts.isRegularExpressionLiteral(node)

/**
 * 判断节点是否为布尔字面量。
 *
 * @source QuickJS/src/core/parser.c:6331-6482
 * @see js_parse_expr
 */
export const isBooleanLiteral = (node: ts.Node): node is ts.BooleanLiteral =>
  node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword

/**
 * 判断节点是否为赋值表达式。
 *
 * @source QuickJS/src/core/parser.c:6511-6850
 * @see js_parse_assign_expr2
 */
export const isAssignmentExpression = (node: ts.Node): node is ts.BinaryExpression => {
  if (!ts.isBinaryExpression(node)) return false
  const kind = node.operatorToken.kind
  return kind >= ts.SyntaxKind.FirstAssignment && kind <= ts.SyntaxKind.LastAssignment
}

/**
 * 判断节点是否为一元表达式。
 *
 * @source QuickJS/src/core/parser.c:5945-6075
 * @see js_parse_unary
 */
export const isUnaryExpression = (node: ts.Node): node is ts.PrefixUnaryExpression | ts.PostfixUnaryExpression =>
  ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)

/**
 * 判断节点是否为调用表达式。
 *
 * @source QuickJS/src/core/parser.c:6077-6235
 * @see js_parse_postfix_expr
 */
export const isCallLikeExpression = (node: ts.Node): node is ts.CallExpression | ts.NewExpression =>
  ts.isCallExpression(node) || ts.isNewExpression(node)

/**
 * 判断节点是否为成员访问表达式。
 *
 * @source QuickJS/src/core/parser.c:6077-6235
 * @see js_parse_postfix_expr
 */
export const isMemberAccessExpression = (
  node: ts.Node,
): node is ts.PropertyAccessExpression | ts.ElementAccessExpression =>
  ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)

/**
 * 判断节点是否为循环语句。
 *
 * @source QuickJS/src/core/parser.c:6939-7078
 * @see js_parse_statement_or_decl
 */
export const isLoopStatement = (node: ts.Node): node is ts.IterationStatement =>
  ts.isForStatement(node) ||
  ts.isForInStatement(node) ||
  ts.isForOfStatement(node) ||
  ts.isWhileStatement(node) ||
  ts.isDoStatement(node)

/**
 * 判断节点是否为控制流语句。
 *
 * @source QuickJS/src/core/parser.c:6939-7078
 * @see js_parse_statement_or_decl
 */
export const isControlFlowStatement = (node: ts.Node): node is ts.Statement =>
  ts.isIfStatement(node) ||
  ts.isSwitchStatement(node) ||
  ts.isTryStatement(node) ||
  ts.isThrowStatement(node) ||
  ts.isReturnStatement(node) ||
  ts.isBreakStatement(node) ||
  ts.isContinueStatement(node) ||
  ts.isDebuggerStatement(node) ||
  isLoopStatement(node)

/**
 * 判断节点是否为声明语句。
 *
 * @source QuickJS/src/core/parser.c:6939-7078
 * @see js_parse_statement_or_decl
 */
export const isDeclarationStatement = (node: ts.Node): node is ts.Statement =>
  ts.isVariableStatement(node) ||
  ts.isFunctionDeclaration(node) ||
  ts.isClassDeclaration(node) ||
  ts.isEnumDeclaration(node) ||
  ts.isInterfaceDeclaration(node) ||
  ts.isTypeAliasDeclaration(node) ||
  ts.isModuleDeclaration(node) ||
  ts.isImportDeclaration(node) ||
  ts.isImportEqualsDeclaration(node)
