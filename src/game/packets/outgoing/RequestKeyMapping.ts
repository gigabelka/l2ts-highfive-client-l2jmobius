import { PacketWriter } from '../../../network/PacketWriter';
import { Logger } from '../../../logger/Logger';
import { OutgoingGamePacket } from './OutgoingGamePacket';

/**
 * RequestKeyMapping (OpCode=0xCE) — request keybinding configuration.
 */
export class RequestKeyMapping implements OutgoingGamePacket {
    encode(): Buffer {
        const w = new PacketWriter();
        w.writeUInt8(0xCE);
        const body = w.toBuffer();
        Logger.logPacket('SEND', 0xCE, body);
        return body;
    }
}
