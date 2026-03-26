/**
 * @fileoverview PacketWriter - Binary writer for Lineage 2 packet data
 * 
 * Provides methods for writing primitive data types to packet buffers
 * using little-endian byte order (standard for Lineage 2 protocol).
 * 
 * Supported data types:
 * - Integers: uint8, uint16LE, int32LE, int64LE (bigint)
 * - Floating point: floatLE, double
 * - Strings: UTF-16LE null-terminated
 * - Raw bytes: writeBytes(buffer)
 * 
 * The writer accumulates data in chunks and builds the final buffer
 * when requested. This allows efficient construction of variable-length
 * packets.
 * 
 * @module network/PacketWriter
 * @example
 * ```typescript
 * const writer = new PacketWriter();
 * 
 * writer
 *   .writeUInt8(0x01)                    // opcode
 *   .writeInt32LE(12345)                 // objectId
 *   .writeStringNullUTF16('PlayerName'); // name
 * 
 * const body = writer.toBuffer();
 * // Add length prefix for L2 protocol
 * const packet = Buffer.alloc(body.length + 2);
 * packet.writeUInt16LE(body.length + 2, 0);
 * body.copy(packet, 2);
 * ```
 */

/**
 * Binary writer for Lineage 2 packet data (little-endian).
 * 
 * Accumulates data in chunks and builds the final buffer on request.
 * All multi-byte values use little-endian byte order as per L2 protocol.
 * 
 * @class PacketWriter
 */
export class PacketWriter {
  /** Array of buffer chunks being accumulated */
  private chunks: Buffer[] = [];

  /**
   * Write an unsigned 8-bit integer.
   * 
   * @param {number} v - Value to write (0-255)
   * @returns {this} This writer for chaining
   * @example
   * ```typescript
   * writer.writeUInt8(0x01); // opcode
   * ```
   */
  writeUInt8(v: number): this {
    const buf = Buffer.alloc(1);
    buf.writeUInt8(v, 0);
    this.chunks.push(buf);
    return this;
  }

  /**
   * Write an unsigned 16-bit integer (little-endian).
   * 
   * @param {number} v - Value to write (0-65535)
   * @returns {this} This writer for chaining
   * @example
   * ```typescript
   * writer.writeUInt16LE(1234);
   * ```
   */
  writeUInt16LE(v: number): this {
    const buf = Buffer.alloc(2);
    buf.writeUInt16LE(v, 0);
    this.chunks.push(buf);
    return this;
  }

  /**
   * Write a signed 32-bit integer (little-endian).
   * 
   * @param {number} v - Value to write (-2^31 to 2^31-1)
   * @returns {this} This writer for chaining
   * @example
   * ```typescript
   * writer.writeInt32LE(-500);  // Coordinates can be negative
   * ```
   */
  writeInt32LE(v: number): this {
    const buf = Buffer.alloc(4);
    buf.writeInt32LE(v, 0);
    this.chunks.push(buf);
    return this;
  }

  /**
   * Write a signed 64-bit integer (little-endian).
   * 
   * @param {bigint} v - Value to write
   * @returns {this} This writer for chaining
   * @example
   * ```typescript
   * writer.writeInt64LE(9007199254740991n); // Large value
   * ```
   */
  writeInt64LE(v: bigint): this {
    const buf = Buffer.alloc(8);
    buf.writeBigInt64LE(v, 0);
    this.chunks.push(buf);
    return this;
  }

  /**
   * Write a 32-bit floating point number (float).
   * 
   * @param {number} v - Value to write
   * @returns {this} This writer for chaining
   * @example
   * ```typescript
   * writer.writeFloatLE(3.14);
   * ```
   */
  writeFloatLE(v: number): this {
    const buf = Buffer.alloc(4);
    buf.writeFloatLE(v, 0);
    this.chunks.push(buf);
    return this;
  }

  /**
   * Write a 64-bit floating point number (double).
   * 
   * @param {number} v - Value to write
   * @returns {this} This writer for chaining
   * @example
   * ```typescript
   * writer.writeDouble(3.14159265359);
   * ```
   */
  writeDouble(v: number): this {
    const buf = Buffer.alloc(8);
    buf.writeDoubleLE(v, 0);
    this.chunks.push(buf);
    return this;
  }

  /**
   * Write raw bytes from a buffer.
   * 
   * @param {Buffer} b - Buffer to write (copied)
   * @returns {this} This writer for chaining
   * @example
   * ```typescript
   * const data = Buffer.from([1, 2, 3, 4]);
   * writer.writeBytes(data);
   * ```
   */
  writeBytes(b: Buffer): this {
    this.chunks.push(Buffer.from(b));
    return this;
  }

  /**
   * Write a null-terminated UTF-16LE string.
   * 
   * The string is encoded as UTF-16LE and terminated with two null bytes.
   * Commonly used for character names in L2 packets.
   * 
   * @param {string} s - String to write
   * @returns {this} This writer for chaining
   * @example
   * ```typescript
   * writer.writeStringNullUTF16('PlayerName');
   * ```
   */
  writeStringNullUTF16(s: string): this {
    if (s.length === 0) {
      const term = Buffer.from([0x00, 0x00]);
      this.chunks.push(term);
      return this;
    }

    const buf = Buffer.alloc(s.length * 2 + 2);
    buf.write(s, 0, s.length * 2, 'utf16le');
    buf[s.length * 2] = 0x00;
    buf[s.length * 2 + 1] = 0x00;
    this.chunks.push(buf);
    return this;
  }

  /**
   * Build and return the final buffer.
   * 
   * Returns the accumulated data as a single buffer. This does NOT
   * include the L2 length prefix - add it separately if needed.
   * 
   * @returns {Buffer} Concatenated buffer containing all written data
   * @example
   * ```typescript
   * const body = writer.toBuffer();
   * 
   // Add L2 length prefix
   * const packet = Buffer.alloc(body.length + 2);
   * packet.writeUInt16LE(body.length + 2, 0);
   * body.copy(packet, 2);
   * ```
   */
  toBuffer(): Buffer {
    if (this.chunks.length === 0) {
      return Buffer.alloc(0);
    }
    const total = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = Buffer.alloc(total);
    let offset = 0;
    for (const chunk of this.chunks) {
      chunk.copy(result, offset);
      offset += chunk.length;
    }
    return result;
  }

  /**
   * Reset the writer, clearing all accumulated data.
   * 
   * @returns {this} This writer for chaining
   * @example
   * ```typescript
   * writer
   *   .writeUInt8(0x01)
   *   .toBuffer();
   * 
   * writer.reset(); // Clear for reuse
   * ```
   */
  reset(): this {
    this.chunks = [];
    return this;
  }
}
