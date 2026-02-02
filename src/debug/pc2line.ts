export interface PC2LineEntry {
  pc: number
  line: number
}

/**
 * PC 到行号映射（占位实现）。
 *
 * @source QuickJS/src/core/parser.c:11890-12020
 * @see add_pc2line_info
 */
export class PC2LineTable {
  private entries: PC2LineEntry[] = []

  add(pc: number, line: number) {
    this.entries.push({ pc, line })
  }

  getLine(pc: number): number | undefined {
    const match = this.entries
      .filter(entry => entry.pc <= pc)
      .sort((a, b) => b.pc - a.pc)[0]
    return match?.line
  }

  snapshot(): PC2LineEntry[] {
    return [...this.entries]
  }
}
