export { ScopeManager, type ScopeManagerState } from '../emitter/scope-manager'

/**
 * 作用域表管理（对齐 QuickJS scope/vars 结构）。
 *
 * @source QuickJS/src/core/parser.c:1940-2165
 * @see push_scope
 */
