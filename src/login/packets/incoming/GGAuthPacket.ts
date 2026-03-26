import { Logger } from '../../../logger/Logger';
import type { IncomingLoginPacket, PacketReader } from './IncomingLoginPacket';

/**
 * GGAuthPacket (OpCode=0x0B) — GameGuard authentication response.
 * The ggAuthResponse value must be included in the subsequent RequestAuthLogin packet.
 */
export class GGAuthPacket implements IncomingLoginPacket {
  public ggAuthResponse: number = 0;

  decode(reader: PacketReader): this {
    reader.readUInt8();  // opcode 0x0B

    this.ggAuthResponse = reader.readInt32();

    Logger.info('GGAuthPacket', `GGAuth response: ${this.ggAuthResponse} (0x${this.ggAuthResponse.toString(16).toUpperCase()})`);

    return this;
  }
}
