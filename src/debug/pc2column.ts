export interface PC2ColumnEntry {
  pc: number
  column: number
}

/**
 * PC 到列号映射（占位实现）。
 *
 * @source QuickJS/src/core/parser.c:12020-12130
 * @see add_pc2column_info
 */
export class PC2ColumnTable {
  private entries: PC2ColumnEntry[] = []

  add(pc: number, column: number) {
    this.entries.push({ pc, column })
  }

  getColumn(pc: number): number | undefined {
    const match = this.entries
      .filter(entry => entry.pc <= pc)
      .sort((a, b) => b.pc - a.pc)[0]
    return match?.column
  }

  snapshot(): PC2ColumnEntry[] {
    return [...this.entries]
  }
}
