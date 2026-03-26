import { Logger } from '../../../logger/Logger';
import type { IncomingLoginPacket, PacketReader } from './IncomingLoginPacket';

/**
 * InitPacket (OpCode=0x00) — Login Server initialization.
 * Contains session ID, scrambled RSA key (128 bytes), and Blowfish key (16 bytes).
 * Protocol revision must be 0xC621 for Interlude.
 */
export class InitPacket implements IncomingLoginPacket {
  private static readonly SCRAMBLED_RSA_KEY_SIZE = 128;
  private static readonly UNKNOWN_BYTES_SIZE = 16;

  public sessionId: number = 0;
  public protocolRevision: number = 0;
  public scrambledRsaKey: Buffer = Buffer.alloc(0);
  public blowfishKey: Buffer = Buffer.alloc(0);

  decode(reader: PacketReader): this {
    Logger.info('InitPacket', 'Decoding Init packet');

    reader.readUInt8();  // opcode 0x00

    this.sessionId = reader.readInt32();
    Logger.info('InitPacket', `sessionId: ${this.sessionId} (0x${this.sessionId.toString(16).toUpperCase()})`);

    this.protocolRevision = reader.readInt32();
    Logger.info('InitPacket', `protocolRevision=0x${this.protocolRevision.toString(16).toUpperCase()}`);

    if (this.protocolRevision !== 0xc621) {
      Logger.warn('InitPacket', `Unexpected protocol revision: 0x${this.protocolRevision.toString(16).toUpperCase()} (expected 0xC621)`);
    }

    this.scrambledRsaKey = reader.readBytes(InitPacket.SCRAMBLED_RSA_KEY_SIZE);
    Logger.info('InitPacket', `scrambledRsaKey: ${this.scrambledRsaKey.length} bytes`);

    // 4 unknown int32 values (16 bytes)
    reader.readBytes(InitPacket.UNKNOWN_BYTES_SIZE);

    this.blowfishKey = reader.readBytes(16);
    Logger.info('InitPacket', `blowfishKey: ${this.hexDump(this.blowfishKey)}`);

    // Null terminator byte (should be 0x00)
    const nullByte = reader.readUInt8();
    if (nullByte !== 0x00) {
      Logger.warn('InitPacket', `Expected terminator=0x00, got 0x${nullByte.toString(16).toUpperCase()}`);
    }

    const remaining = reader.remaining().length;
    if (remaining > 0) {
      Logger.warn('InitPacket', `Remaining data: ${remaining} bytes`);
    }

    Logger.info('InitPacket', 'Init packet decoded successfully');
    return this;
  }

  private hexDump(buffer: Buffer): string {
    const hexArray = Array.from(buffer as Uint8Array, (b: number) => b.toString(16).padStart(2, '0').toUpperCase());
    return hexArray.join(' ');
  }
}
