/**
 * 动态字节码缓冲区。
 *
 * @source parser.c: DynBuf
 */
export class BytecodeBuffer {
  private buffer: Uint8Array
  private length = 0
  private hasError = false

  constructor(initialSize = 64) {
    this.buffer = new Uint8Array(initialSize)
  }

  get size(): number {
    return this.length
  }

  get buf(): Uint8Array {
    return this.buffer.subarray(0, this.length)
  }

  get error(): boolean {
    return this.hasError
  }

  setError(): void {
    this.hasError = true
  }

  reserve(additional: number): number {
    const required = this.length + additional
    if (required <= this.buffer.length) return this.length
    let nextSize = this.buffer.length
    while (nextSize < required) nextSize = Math.max(64, Math.floor(nextSize * 1.5))
    const next = new Uint8Array(nextSize)
    next.set(this.buffer)
    this.buffer = next
    return this.length
  }

  writeU8(value: number): number {
    const offset = this.reserve(1)
    this.buffer[offset] = value & 0xff
    this.length += 1
    return offset
  }

  writeU16(value: number): number {
    const offset = this.reserve(2)
    this.buffer[offset] = value & 0xff
    this.buffer[offset + 1] = (value >> 8) & 0xff
    this.length += 2
    return offset
  }

  writeU32(value: number): number {
    const offset = this.reserve(4)
    this.buffer[offset] = value & 0xff
    this.buffer[offset + 1] = (value >> 8) & 0xff
    this.buffer[offset + 2] = (value >> 16) & 0xff
    this.buffer[offset + 3] = (value >> 24) & 0xff
    this.length += 4
    return offset
  }

  writeI32(value: number): number {
    return this.writeU32(value | 0)
  }

  writeBytes(bytes: Uint8Array): number {
    const offset = this.reserve(bytes.length)
    this.buffer.set(bytes, offset)
    this.length += bytes.length
    return offset
  }

  patchU32(offset: number, value: number): void {
    if (offset + 4 > this.buffer.length) {
      this.setError()
      return
    }
    this.buffer[offset] = value & 0xff
    this.buffer[offset + 1] = (value >> 8) & 0xff
    this.buffer[offset + 2] = (value >> 16) & 0xff
    this.buffer[offset + 3] = (value >> 24) & 0xff
  }
}
