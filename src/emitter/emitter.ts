import type { JSAtom, JSFunctionDef } from '../types/function-def'
import { BytecodeBuffer } from './bytecode-buffer'

export interface EmitHooks {
  onEmitOp?: (op: number, offset: number) => void
  onEmitU8?: (value: number, offset: number) => void
  onEmitU16?: (value: number, offset: number) => void
  onEmitU32?: (value: number, offset: number) => void
  onEmitAtom?: (atom: JSAtom, offset: number) => void
}

/**
 * 字节码发射器。
 *
 * @source parser.c: emit_op/emit_u8/emit_u16/emit_u32/emit_atom/emit_source_pos
 */
export class Emitter {
  private readonly bc: BytecodeBuffer
  private lastOpcodeSourcePos: number | null = null

  constructor(
    private readonly fd: JSFunctionDef,
    private readonly hooks: EmitHooks = {},
  ) {
    this.bc = fd.byteCode as unknown as BytecodeBuffer
  }

  emitOp(op: number): void {
    const offset = this.bc.writeU8(op)
    this.fd.lastOpcodePos = offset
    this.hooks.onEmitOp?.(op, offset)
  }

  emitU8(value: number): void {
    const offset = this.bc.writeU8(value)
    this.hooks.onEmitU8?.(value, offset)
  }

  emitU16(value: number): void {
    const offset = this.bc.writeU16(value)
    this.hooks.onEmitU16?.(value, offset)
  }

  emitU32(value: number): void {
    const offset = this.bc.writeU32(value)
    this.hooks.onEmitU32?.(value, offset)
  }

  emitSourcePos(opLineNum: number, sourcePos: number): void {
    if (this.lastOpcodeSourcePos === sourcePos) return
    this.emitOp(opLineNum)
    this.emitU32(sourcePos)
    this.lastOpcodeSourcePos = sourcePos
    this.fd.lastOpcodeSourcePtr = sourcePos
  }

  emitAtom(atom: JSAtom): void {
    const offset = this.bc.writeU32(atom)
    this.hooks.onEmitAtom?.(atom, offset)
  }

  emitIC(atom: JSAtom): void {
    void atom
    // IC 记录由后续模块注入
  }
}
