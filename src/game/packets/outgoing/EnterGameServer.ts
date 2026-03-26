import { PacketWriter } from '../../../network/PacketWriter';
import { Logger } from '../../../logger/Logger';
import { OutgoingGamePacket } from './OutgoingGamePacket';

/**
 * EnterGameServer (OpCode=0xD0, sub=0x08) — confirm game server entry.
 *
 * L2J Mobius CT0: sends 0xD0 0x08 0x00 (5 bytes total with length).
 */
export class EnterGameServer implements OutgoingGamePacket {
    encode(): Buffer {
        const w = new PacketWriter();
        w.writeUInt8(0xD0);
        w.writeUInt16LE(0x0008);
        const body = w.toBuffer();
        Logger.logPacket('SEND', 0xD0, body);
        Logger.debug('EnterGameServer', `Encoded: bodyLen=${body.length}`);
        return body;
    }
}
