export interface BytecodeBufferState {
  buffer: Uint8Array
  size: number
}

/**
 * 字节码动态缓冲区（等价 DynBuf）。
 *
 * @source QuickJS/src/cutils.c:89-140
 * @see dbuf_init2
 */
export class BytecodeBuffer {
  private buffer: Uint8Array
  private size: number
  private error: boolean

  constructor(initialSize = 256) {
    this.buffer = new Uint8Array(initialSize)
    this.size = 0
    this.error = false
  }

  /**
   * 当前写入长度。
   *
   * @source QuickJS/src/cutils.c:111-137
   * @see dbuf_realloc
   */
  get length() {
    return this.size
  }

  /**
   * 是否发生错误（对齐 DynBuf.error）。
   *
   * @source QuickJS/src/QuickJS/cutils.h:293-325
   * @see dbuf_error
   */
  get hasError() {
    return this.error
  }

  /**
   * 获取已写入的字节视图。
   *
   * @source QuickJS/src/cutils.c:111-137
   * @see dbuf_realloc
   */
  toUint8Array(): Uint8Array {
    return this.buffer.slice(0, this.size)
  }

  /**
   * 获取当前缓冲区状态。
   *
   * @source QuickJS/src/cutils.c:111-137
   * @see dbuf_realloc
   */
  snapshot(): BytecodeBufferState {
    return { buffer: this.buffer.slice(0, this.size), size: this.size }
  }

  /**
   * 预留指定字节，返回起始偏移。
   *
   * @source QuickJS/src/cutils.c:111-137
   * @see dbuf_realloc
   */
  reserve(count: number): number {
    const offset = this.size
    this.grow(count)
    this.buffer.fill(0, offset, offset + count)
    return offset
  }

  /**
   * 写入原始字节序列。
   *
   * @source QuickJS/src/cutils.c:121-137
   * @see dbuf_put
   */
  writeBytes(data: Uint8Array | number[]): number {
    const bytes = data instanceof Uint8Array ? data : Uint8Array.from(data)
    const offset = this.size
    this.grow(bytes.length)
    this.buffer.set(bytes, offset)
    return offset
  }

  /**
   * 写入自身缓冲区的一段。
   *
   * @source QuickJS/src/cutils.c:140-171
   * @see dbuf_put_self
   */
  writeSelf(offset: number, length: number): number {
    const slice = this.buffer.slice(offset, offset + length)
    return this.writeBytes(slice)
  }

  /**
   * 写入单字节。
   *
   * @source QuickJS/src/cutils.c:173-183
   * @see dbuf_putc
   */
  writeU8(value: number): number {
    const offset = this.reserve(1)
    this.buffer[offset] = value & 0xff
    return offset
  }

  /**
   * 写入无符号 16 位整数（小端）。
   *
   * @source QuickJS/src/QuickJS/cutils.h:310-314
   * @see dbuf_put_u16
   */
  writeU16(value: number): number {
    const offset = this.reserve(2)
    this.buffer[offset] = value & 0xff
    this.buffer[offset + 1] = (value >>> 8) & 0xff
    return offset
  }

  /**
   * 写入无符号 32 位整数（小端）。
   *
   * @source QuickJS/src/QuickJS/cutils.h:313-316
   * @see dbuf_put_u32
   */
  writeU32(value: number): number {
    const offset = this.reserve(4)
    this.buffer[offset] = value & 0xff
    this.buffer[offset + 1] = (value >>> 8) & 0xff
    this.buffer[offset + 2] = (value >>> 16) & 0xff
    this.buffer[offset + 3] = (value >>> 24) & 0xff
    return offset
  }

  /**
   * 写入有符号 32 位整数（小端）。
   *
   * @source QuickJS/src/cutils.c:121-137
   * @see dbuf_put
   */
  writeI32(value: number): number {
    return this.writeU32(value >>> 0)
  }

  /**
   * 在指定位置覆写字节序列。
   *
   * @source QuickJS/src/cutils.c:111-119
   * @see dbuf_write
   */
  writeAt(offset: number, data: Uint8Array | number[]): void {
    const bytes = data instanceof Uint8Array ? data : Uint8Array.from(data)
    const end = offset + bytes.length
    if (end > this.size) this.grow(end - this.size)
    this.buffer.set(bytes, offset)
  }

  /**
   * 覆写单字节。
   *
   * @source QuickJS/src/cutils.c:111-119
   * @see dbuf_write
   */
  patchU8(offset: number, value: number): void {
    this.writeAt(offset, [value & 0xff])
  }

  /**
   * 覆写 16 位整数。
   *
   * @source QuickJS/src/cutils.c:111-119
   * @see dbuf_write
   */
  patchU16(offset: number, value: number): void {
    this.writeAt(offset, [value & 0xff, (value >>> 8) & 0xff])
  }

  /**
   * 覆写 32 位整数。
   *
   * @source QuickJS/src/cutils.c:111-119
   * @see dbuf_write
   */
  patchU32(offset: number, value: number): void {
    this.writeAt(offset, [
      value & 0xff,
      (value >>> 8) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 24) & 0xff,
    ])
  }

  /**
   * 覆写有符号 32 位整数。
   *
   * @source QuickJS/src/cutils.c:111-119
   * @see dbuf_write
   */
  patchI32(offset: number, value: number): void {
    this.patchU32(offset, value >>> 0)
  }

  private grow(size: number) {
    if (this.error) return
    const nextSize = this.size + size
    if (nextSize <= this.buffer.length) {
      this.size = nextSize
      return
    }

    let newLength = Math.max(this.buffer.length * 1.5, nextSize)
    newLength = Math.max(newLength, 64)
    const newBuffer = new Uint8Array(Math.ceil(newLength))
    newBuffer.set(this.buffer)
    this.buffer = newBuffer
    this.size = nextSize
  }
}
