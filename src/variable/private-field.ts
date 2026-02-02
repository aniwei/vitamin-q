export type PrivateFieldKind = 'field' | 'method' | 'accessor'

export interface PrivateFieldBinding {
  name: string
  index: number
  kind: PrivateFieldKind
}

/**
 * 私有字段解析与绑定管理。
 *
 * @source QuickJS/src/core/parser.c:5440-5475
 * @see js_parse_postfix_expr
 */
export class PrivateFieldManager {
  private bindings = new Map<string, PrivateFieldBinding>()
  private nextIndex = 0

  define(name: string, kind: PrivateFieldKind): PrivateFieldBinding {
    const existing = this.bindings.get(name)
    if (existing) return existing
    const binding = { name, kind, index: this.nextIndex++ }
    this.bindings.set(name, binding)
    return binding
  }

  get(name: string): PrivateFieldBinding | undefined {
    return this.bindings.get(name)
  }

  snapshot(): PrivateFieldBinding[] {
    return [...this.bindings.values()]
  }
}
