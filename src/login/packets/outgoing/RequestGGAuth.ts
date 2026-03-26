import { Logger } from '../../../logger/Logger';
import type { OutgoingLoginPacket } from './OutgoingLoginPacket';

/**
 * RequestGGAuth (OpCode=0x07) — GameGuard authentication request.
 * Body: 1(opcode) + 4(sessionId) + 16(GG constants) + 19(zeros) = 40 bytes
 */
export class RequestGGAuth implements OutgoingLoginPacket {
  private sessionId: number;

  constructor(sessionId: number) {
    this.sessionId = sessionId;
  }

  encode(): Buffer {
    const bodySize = 1 + 4 + 16 + 19;
    const buffer = Buffer.alloc(bodySize);
    let offset = 0;

    buffer.writeUInt8(0x07, offset); offset += 1;
    buffer.writeInt32LE(this.sessionId, offset); offset += 4;

    buffer.writeInt32LE(0x00000123, offset); offset += 4;
    buffer.writeInt32LE(0x00004567, offset); offset += 4;
    buffer.writeInt32LE(0x000089AB, offset); offset += 4;
    buffer.writeInt32LE(0x0000CDEF, offset); offset += 4;

    buffer.fill(0, offset, offset + 19);

    Logger.debug('RequestGGAuth', `Encoded: bodyLen=${bodySize}`);
    return buffer;
  }
}
