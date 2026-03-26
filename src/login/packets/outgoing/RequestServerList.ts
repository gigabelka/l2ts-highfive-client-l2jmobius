import { Logger } from '../../../logger/Logger';
import type { OutgoingLoginPacket } from './OutgoingLoginPacket';

/**
 * RequestServerList (OpCode=0x05) — request list of game servers.
 */
export class RequestServerList implements OutgoingLoginPacket {
  constructor(
    private loginOkId1: number,
    private loginOkId2: number,
  ) {}

  encode(): Buffer {
    const bodySize = 1 + 4 + 4 + 4;
    const buffer = Buffer.alloc(bodySize);
    let offset = 0;

    buffer.writeUInt8(0x05, offset); offset += 1;
    buffer.writeInt32LE(this.loginOkId1, offset); offset += 4;
    buffer.writeInt32LE(this.loginOkId2, offset); offset += 4;
    buffer.writeInt32LE(0x04000000, offset);

    Logger.debug('RequestServerList', `Encoded: bodyLen=${bodySize}`);
    return buffer;
  }
}
