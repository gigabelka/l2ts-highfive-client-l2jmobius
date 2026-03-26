import { PacketWriter } from '../../../network/PacketWriter';
import { Logger } from '../../../logger/Logger';
import { OutgoingGamePacket } from './OutgoingGamePacket';

/**
 * NetPing (OpCode=0xA8) — keepalive pong response to server's NetPingRequest.
 */
export class NetPing implements OutgoingGamePacket {
    constructor(private pingId: number) {}

    encode(): Buffer {
        const w = new PacketWriter();
        w.writeUInt8(0xA8);
        w.writeInt32LE(this.pingId);
        w.writeInt32LE(0x00000000);
        w.writeInt32LE(0x00080000);
        const body = w.toBuffer();
        Logger.logPacket('SEND', 0xA8, body);
        Logger.debug('NetPing', `Encoded: pingId=${this.pingId}, bodyLen=${body.length}`);
        return body;
    }
}
