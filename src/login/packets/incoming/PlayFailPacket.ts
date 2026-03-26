import { Logger } from '../../../logger/Logger';
import type { IncomingLoginPacket, PacketReader } from './IncomingLoginPacket';

/**
 * PlayFailPacket (OpCode=0x06) — game server login failure.
 */
export class PlayFailPacket implements IncomingLoginPacket {
  public reason: number = 0;

  decode(reader: PacketReader): this {
    reader.readUInt8();  // opcode 0x06
    this.reason = reader.readInt32();

    Logger.error('PlayFailPacket', `Play failed: ${PlayFailPacket.getReasonMessage(this.reason)}`);
    return this;
  }

  static getReasonMessage(code: number): string {
    switch (code) {
      case 0x03: return "Password mismatch";
      case 0x04: return "Access error, try later";
      case 0x0F: return "Too many players";
      default:   return `Unknown reason (0x${code.toString(16).toUpperCase()})`;
    }
  }
}
