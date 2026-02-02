import type { PrivateFieldBinding, PrivateFieldKind } from '../variable/private-field'

/**
 * 私有字段发射辅助。
 *
 * @source QuickJS/src/core/parser.c:5440-5475
 * @see js_parse_postfix_expr
 */
export const definePrivateBinding = (
  bindings: Map<string, PrivateFieldBinding>,
  name: string,
  kind: PrivateFieldKind,
  index: number,
) => {
  bindings.set(name, { name, kind, index })
}
