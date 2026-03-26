export interface IncomingLoginPacket {
  decode(reader: PacketReader): this;
}

/**
 * Simple binary reader for Login Server packets.
 * Separate from network/PacketReader because login packets use a different
 * naming convention (readInt32 vs readInt32LE) and have login-specific helpers.
 */
export class PacketReader {
  private buffer: Buffer;
  private offset: number = 0;

  constructor(buffer: Buffer) {
    this.buffer = buffer;
  }

  readInt32(): number {
    if (this.offset + 4 > this.buffer.length) {
      throw new Error(`PacketReader: not enough data for int32 at offset ${this.offset}`);
    }
    const value = this.buffer.readInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  readUInt8(): number {
    if (this.offset + 1 > this.buffer.length) {
      throw new Error(`PacketReader: not enough data for uint8 at offset ${this.offset}`);
    }
    const value = this.buffer.readUInt8(this.offset);
    this.offset += 1;
    return value;
  }

  readInt16(): number {
    if (this.offset + 2 > this.buffer.length) {
      throw new Error(`PacketReader: not enough data for int16 at offset ${this.offset}`);
    }
    const value = this.buffer.readInt16LE(this.offset);
    this.offset += 2;
    return value;
  }

  readUInt16(): number {
    if (this.offset + 2 > this.buffer.length) {
      throw new Error(`PacketReader: not enough data for uint16 at offset ${this.offset}`);
    }
    const value = this.buffer.readUInt16LE(this.offset);
    this.offset += 2;
    return value;
  }

  readBytes(length: number): Buffer {
    if (this.offset + length > this.buffer.length) {
      throw new Error(`PacketReader: not enough data for ${length} bytes at offset ${this.offset}`);
    }
    const value = this.buffer.slice(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  remaining(): Buffer {
    return this.buffer.slice(this.offset);
  }

  currentOffset(): number {
    return this.offset;
  }

  ensureAvailable(bytes: number): boolean {
    return this.buffer.length - this.offset >= bytes;
  }

  // Methods for IPacketReader compatibility
  readUInt16LE(): number {
    return this.readUInt16();
  }

  readInt16LE(): number {
    return this.readInt16();
  }

  readInt32LE(): number {
    return this.readInt32();
  }

  readInt64LE(): bigint {
    if (this.offset + 8 > this.buffer.length) {
      throw new Error(`PacketReader: not enough data for int64 at offset ${this.offset}`);
    }
    const value = this.buffer.readBigInt64LE(this.offset);
    this.offset += 8;
    return value;
  }

  readDouble(): number {
    if (this.offset + 8 > this.buffer.length) {
      throw new Error(`PacketReader: not enough data for double at offset ${this.offset}`);
    }
    const value = this.buffer.readDoubleLE(this.offset);
    this.offset += 8;
    return value;
  }

  readFloatLE(): number {
    if (this.offset + 4 > this.buffer.length) {
      throw new Error(`PacketReader: not enough data for float at offset ${this.offset}`);
    }
    const value = this.buffer.readFloatLE(this.offset);
    this.offset += 4;
    return value;
  }

  readStringUTF16(): string {
    if (this.offset + 2 > this.buffer.length) {
      throw new Error('PacketReader: not enough data to read UTF-16 string terminator');
    }

    let endPos = this.offset;
    while (endPos + 1 < this.buffer.length) {
      if (this.buffer[endPos] === 0x00 && this.buffer[endPos + 1] === 0x00) {
        break;
      }
      endPos += 2;
    }

    if (endPos + 1 >= this.buffer.length) {
      throw new Error('PacketReader: UTF-16 string without terminator');
    }

    const strBuffer = this.buffer.slice(this.offset, endPos);
    let result = '';

    try {
      result = strBuffer.toString('utf16le');
    } catch (e) {
      console.warn('UTF-16 decode error:', e);
    }

    this.offset = endPos + 2;
    return result;
  }

  skip(n: number): this {
    if (this.offset + n > this.buffer.length) {
      throw new Error(`PacketReader: cannot skip ${n} bytes. Only ${this.buffer.length - this.offset} available`);
    }
    this.offset += n;
    return this;
  }

  getBuffer(): Buffer {
    return this.buffer;
  }
}
