import { Logger } from '../../../logger/Logger';
import type { OutgoingLoginPacket } from './OutgoingLoginPacket';

/**
 * RequestServerLogin (OpCode=0x02) — request to join a specific game server.
 */
export class RequestServerLogin implements OutgoingLoginPacket {
  constructor(
    private loginOkId1: number,
    private loginOkId2: number,
    private serverId: number,
  ) {}

  encode(): Buffer {
    const bodySize = 1 + 4 + 4 + 1;
    const buffer = Buffer.alloc(bodySize);
    let offset = 0;

    buffer.writeUInt8(0x02, offset); offset += 1;
    buffer.writeInt32LE(this.loginOkId1, offset); offset += 4;
    buffer.writeInt32LE(this.loginOkId2, offset); offset += 4;
    buffer.writeUInt8(this.serverId, offset);

    Logger.debug('RequestServerLogin', `Encoded: serverId=${this.serverId}, bodyLen=${bodySize}`);
    return buffer;
  }
}
