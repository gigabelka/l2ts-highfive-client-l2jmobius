import { Logger } from '../../../logger/Logger';
import type { IncomingLoginPacket, PacketReader } from './IncomingLoginPacket';

/**
 * LoginFailPacket (OpCode=0x01) — login authentication failure with reason code.
 */
export class LoginFailPacket implements IncomingLoginPacket {
  public reason: number = 0;

  decode(reader: PacketReader): this {
    reader.readUInt8();  // opcode 0x01
    this.reason = reader.readUInt8();

    Logger.error('LoginFailPacket', `Auth failed: ${LoginFailPacket.getReasonMessage(this.reason)}`);
    return this;
  }

  static getReasonMessage(code: number): string {
    switch (code) {
      case 0x01: return "System error";
      case 0x02: return "Wrong password";
      case 0x03: return "Wrong login or password";
      case 0x04: return "Access denied";
      case 0x05: return "Invalid account info";
      case 0x06: return "Access denied (try later)";
      case 0x07: return "Account already in use";
      case 0x08: return "Age restriction";
      case 0x09: return "Server full";
      case 0x10: return "Maintenance";
      case 0x11: return "Temporary ban";
      case 0x23: return "Dual box restriction";
      default:   return `Unknown reason (0x${code.toString(16).toUpperCase()})`;
    }
  }
}
