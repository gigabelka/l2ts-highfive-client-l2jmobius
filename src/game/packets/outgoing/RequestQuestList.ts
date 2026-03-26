import { PacketWriter } from '../../../network/PacketWriter';
import { Logger } from '../../../logger/Logger';
import { OutgoingGamePacket } from './OutgoingGamePacket';

/**
 * RequestQuestList (OpCode=0x63) — request active quest list.
 */
export class RequestQuestList implements OutgoingGamePacket {
    encode(): Buffer {
        const w = new PacketWriter();
        w.writeUInt8(0x63);
        const body = w.toBuffer();
        Logger.logPacket('SEND', 0x63, body);
        Logger.debug('RequestQuestList', `Encoded: bodyLen=${body.length}`);
        return body;
    }
}
