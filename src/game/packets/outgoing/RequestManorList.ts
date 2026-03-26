import { PacketWriter } from '../../../network/PacketWriter';
import { Logger } from '../../../logger/Logger';
import { OutgoingGamePacket } from './OutgoingGamePacket';

/**
 * RequestManorList (OpCode=0xD0, sub=0x0008) — request manor zone list.
 */
export class RequestManorList implements OutgoingGamePacket {
    encode(): Buffer {
        const w = new PacketWriter();
        w.writeUInt8(0xD0);
        w.writeUInt16LE(0x0008);
        const body = w.toBuffer();
        Logger.logPacket('SEND', 0xD0, body);
        Logger.debug('RequestManorList', `Encoded: bodyLen=${body.length}`);
        return body;
    }
}
