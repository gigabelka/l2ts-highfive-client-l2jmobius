/**
 * @fileoverview PacketReader - Binary reader for Lineage 2 packet data
 * 
 * Provides methods for reading primitive data types from packet buffers
 * using little-endian byte order (standard for Lineage 2 protocol).
 * 
 * Supported data types:
 * - Integers: uint8, uint16LE, int16LE, int32LE, int64LE (bigint)
 * - Floating point: floatLE, double
 * - Strings: UTF-16LE null-terminated
 * - Raw bytes: readBytes(n)
 * 
 * The reader maintains an internal position pointer that advances
 * automatically as data is read.
 * 
 * @module network/PacketReader
 * @example
 * ```typescript
 * const reader = new PacketReader(packetBody);
 * 
 * const opcode = reader.readUInt8();      // 1 byte
 * const objectId = reader.readInt32LE();  // 4 bytes
 * const name = reader.readStringUTF16();  // null-terminated UTF-16LE
 * const remaining = reader.remaining();   // bytes left
 * ```
 */

/**
 * Binary reader for Lineage 2 packet data (little-endian).
 * 
 * Reads primitive data types from a Buffer with automatic
 * position tracking. All multi-byte values use little-endian
 * byte order as per L2 protocol specification.
 * 
 * @class PacketReader
 */
export class PacketReader {
  /**
   * Create a new PacketReader.
   * 
   * @param {Buffer} buf - Buffer to read from
   * @param {number} [pos=0] - Initial read position (default: 0)
   * @example
   * ```typescript
   * // Read from packet body (skipping opcode)
   * const reader = new PacketReader(packet, 1);
   * ```
   */
  constructor(
    private buf: Buffer,
    private pos: number = 0
  ) {}

  /**
   * Read an unsigned 8-bit integer.
   * 
   * @returns {number} Value (0-255)
   * @throws {Error} If not enough data available
   */
  readUInt8(): number {
    const v = this.buf.readUInt8(this.pos);
    this.pos += 1;
    return v;
  }

  /**
   * Read an unsigned 16-bit integer (little-endian).
   * 
   * @returns {number} Value (0-65535)
   * @throws {Error} If not enough data available
   */
  readUInt16LE(): number {
    const v = this.buf.readUInt16LE(this.pos);
    this.pos += 2;
    return v;
  }

  /**
   * Read a signed 16-bit integer (little-endian).
   * 
   * @returns {number} Value (-32768 to 32767)
   * @throws {Error} If not enough data available
   */
  readInt16LE(): number {
    const v = this.buf.readInt16LE(this.pos);
    this.pos += 2;
    return v;
  }

  /**
   * Read a signed 32-bit integer (little-endian).
   * 
   * @returns {number} Value (-2^31 to 2^31-1)
   * @throws {Error} If not enough data available
   */
  readInt32LE(): number {
    const v = this.buf.readInt32LE(this.pos);
    this.pos += 4;
    return v;
  }

  /**
   * Read a signed 64-bit integer (little-endian).
   * 
   * @returns {bigint} 64-bit integer value
   * @throws {Error} If not enough data available
   */
  readInt64LE(): bigint {
    const v = this.buf.readBigInt64LE(this.pos);
    this.pos += 8;
    return v;
  }

  /**
   * Read a 64-bit floating point number (double).
   * 
   * @returns {number} Double precision float
   * @throws {Error} If not enough data available
   */
  readDouble(): number {
    const v = this.buf.readDoubleLE(this.pos);
    this.pos += 8;
    return v;
  }

  /**
   * Read a 32-bit floating point number (float).
   * 
   * @returns {number} Single precision float
   * @throws {Error} If not enough data available
   */
  readFloatLE(): number {
    const v = this.buf.readFloatLE(this.pos);
    this.pos += 4;
    return v;
  }

  /**
   * Read a fixed number of raw bytes.
   * 
   * @param {number} n - Number of bytes to read
   * @returns {Buffer} Buffer containing the bytes (copy)
   * @throws {Error} If not enough data available
   * @example
   * ```typescript
   * const data = reader.readBytes(16); // Read 16 bytes
   * ```
   */
  readBytes(n: number): Buffer {
    if (this.pos + n > this.buf.length) {
      throw new Error(`Not enough data to read ${n} bytes. Available: ${this.buf.length - this.pos}`);
    }
    const result = this.buf.slice(this.pos, this.pos + n);
    this.pos += n;
    return result;
  }

  /**
   * Read a null-terminated UTF-16LE string.
   * 
   * The terminator (two null bytes) is consumed but not returned.
   * Commonly used for character names in L2 packets.
   * 
   * @returns {string} Decoded string
   * @throws {Error} If string terminator not found
   * @example
   * ```typescript
   * const name = reader.readStringUTF16(); // "PlayerName"
   * ```
   */
  readStringUTF16(): string {
    if (this.pos + 2 > this.buf.length) {
      throw new Error('Not enough data to read UTF-16 string terminator');
    }

    let endPos = this.pos;
    while (endPos + 1 < this.buf.length) {
      if (this.buf[endPos] === 0x00 && this.buf[endPos + 1] === 0x00) {
        break;
      }
      endPos += 2;
    }

    if (endPos + 1 >= this.buf.length) {
      throw new Error('UTF-16 string without terminator');
    }

    const strBuffer = this.buf.slice(this.pos, endPos);
    let result = '';

    try {
      result = strBuffer.toString('utf16le');
    } catch (e) {
      console.warn('UTF-16 decode error:', e);
    }

    this.pos = endPos + 2;
    return result;
  }

  /**
   * Get the number of bytes remaining in the buffer.
   * 
   * @returns {number} Bytes left to read
   * @example
   * ```typescript
   * while (reader.remaining() > 0) {
   *   const byte = reader.readUInt8();
   * }
   * ```
   */
  remaining(): number {
    return this.buf.length - this.pos;
  }

  /**
   * Skip forward by a number of bytes.
   * 
   * @param {number} n - Bytes to skip
   * @returns {this} This reader for chaining
   * @throws {Error} If not enough data available
   * @example
   * ```typescript
   * reader.skip(4).readInt32LE(); // Skip 4 bytes, then read
   * ```
   */
  skip(n: number): this {
    if (this.pos + n > this.buf.length) {
      throw new Error(`Cannot skip ${n} bytes. Only ${this.buf.length - this.pos} available`);
    }
    this.pos += n;
    return this;
  }

  /**
   * Get the underlying buffer.
   * 
   * @returns {Buffer} The original buffer (not a copy)
   */
  getBuffer(): Buffer {
    return this.buf;
  }
}
