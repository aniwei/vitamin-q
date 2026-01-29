import ts from 'typescript'

import { isDeclarationNode } from './visitor'
import { isDeclarationStatement } from './utils'

export type DispatchHandler<TNode extends ts.Node, TContext, TResult> = (node: TNode, context: TContext) => TResult

/**
 * AST 调度器：按节点类型分派处理器。
 *
 * @source QuickJS/src/core/parser.c:6939-7078
 * @see js_parse_statement_or_decl
 */
export class AstDispatcher<TContext = void, TResult = void> {
  private expressionHandlers = new Map<ts.SyntaxKind, DispatchHandler<ts.Expression, TContext, TResult>>()
  private statementHandlers = new Map<ts.SyntaxKind, DispatchHandler<ts.Statement, TContext, TResult>>()
  private declarationHandlers = new Map<ts.SyntaxKind, DispatchHandler<ts.Declaration, TContext, TResult>>()

  private expressionFallback?: DispatchHandler<ts.Expression, TContext, TResult>
  private statementFallback?: DispatchHandler<ts.Statement, TContext, TResult>
  private declarationFallback?: DispatchHandler<ts.Declaration, TContext, TResult>
  private fallback?: DispatchHandler<ts.Node, TContext, TResult>

  /**
   * 注册表达式处理器。
   *
   * @source QuickJS/src/core/parser.c:6331-6482
   * @see js_parse_expr
   */
  registerExpression(kind: ts.SyntaxKind, handler: DispatchHandler<ts.Expression, TContext, TResult>) {
    this.expressionHandlers.set(kind, handler)
  }

  /**
   * 注册语句处理器。
   *
   * @source QuickJS/src/core/parser.c:6939-7078
   * @see js_parse_statement_or_decl
   */
  registerStatement(kind: ts.SyntaxKind, handler: DispatchHandler<ts.Statement, TContext, TResult>) {
    this.statementHandlers.set(kind, handler)
  }

  /**
   * 注册声明处理器。
   *
   * @source QuickJS/src/core/parser.c:6939-7078
   * @see js_parse_statement_or_decl
   */
  registerDeclaration(kind: ts.SyntaxKind, handler: DispatchHandler<ts.Declaration, TContext, TResult>) {
    this.declarationHandlers.set(kind, handler)
  }

  /**
   * 设置表达式默认处理器。
   *
   * @source QuickJS/src/core/parser.c:6331-6482
   * @see js_parse_expr
   */
  setExpressionFallback(handler: DispatchHandler<ts.Expression, TContext, TResult>) {
    this.expressionFallback = handler
  }

  /**
   * 设置语句默认处理器。
   *
   * @source QuickJS/src/core/parser.c:6939-7078
   * @see js_parse_statement_or_decl
   */
  setStatementFallback(handler: DispatchHandler<ts.Statement, TContext, TResult>) {
    this.statementFallback = handler
  }

  /**
   * 设置声明默认处理器。
   *
   * @source QuickJS/src/core/parser.c:6939-7078
   * @see js_parse_statement_or_decl
   */
  setDeclarationFallback(handler: DispatchHandler<ts.Declaration, TContext, TResult>) {
    this.declarationFallback = handler
  }

  /**
   * 设置全局默认处理器。
   *
   * @source QuickJS/src/core/parser.c:6939-7078
   * @see js_parse_statement_or_decl
   */
  setFallback(handler: DispatchHandler<ts.Node, TContext, TResult>) {
    this.fallback = handler
  }

  /**
   * 分发任意节点。
   *
   * @source QuickJS/src/core/parser.c:6939-7078
   * @see js_parse_statement_or_decl
   */
  dispatch(node: ts.Node, context: TContext): TResult {
    if (isDeclarationStatement(node) || isDeclarationNode(node)) {
      return this.dispatchDeclaration(node as ts.Declaration, context)
    }
    if (ts.isStatement(node)) {
      return this.dispatchStatement(node, context)
    }
    if (ts.isExpression(node)) {
      return this.dispatchExpression(node, context)
    }
    if (this.fallback) return this.fallback(node, context)
    throw new Error(`未找到节点处理器: ${ts.SyntaxKind[node.kind]}`)
  }

  /**
   * 分发表达式节点。
   *
   * @source QuickJS/src/core/parser.c:6331-6482
   * @see js_parse_expr
   */
  dispatchExpression(node: ts.Expression, context: TContext): TResult {
    const handler = this.expressionHandlers.get(node.kind) ?? this.expressionFallback ?? this.fallback
    if (handler) return handler(node, context)
    throw new Error(`未找到表达式处理器: ${ts.SyntaxKind[node.kind]}`)
  }

  /**
   * 分发语句节点。
   *
   * @source QuickJS/src/core/parser.c:6939-7078
   * @see js_parse_statement_or_decl
   */
  dispatchStatement(node: ts.Statement, context: TContext): TResult {
    const handler = this.statementHandlers.get(node.kind) ?? this.statementFallback ?? this.fallback
    if (handler) return handler(node, context)
    throw new Error(`未找到语句处理器: ${ts.SyntaxKind[node.kind]}`)
  }

  /**
   * 分发声明节点。
   *
   * @source QuickJS/src/core/parser.c:6939-7078
   * @see js_parse_statement_or_decl
   */
  dispatchDeclaration(node: ts.Declaration, context: TContext): TResult {
    const handler = this.declarationHandlers.get(node.kind) ?? this.declarationFallback ?? this.fallback
    if (handler) return handler(node, context)
    throw new Error(`未找到声明处理器: ${ts.SyntaxKind[node.kind]}`)
  }
}
