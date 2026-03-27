import { PacketWriter } from '../../../network/PacketWriter';
import { Logger } from '../../../logger/Logger';
import { OutgoingGamePacket } from './OutgoingGamePacket';

/**
 * RequestKeyMapping — request key mappings from server (HighFive specific).
 *
 * OpCode: 0xD0 0x21 0x00 (Extended packet)
 *
 * This packet is sent after CharSelected instead of EnterWorld for HighFive protocol.
 * It's one of the required initialization packets for CT_2.6_HighFive.
 */
export class RequestKeyMapping implements OutgoingGamePacket {
    encode(): Buffer {
        const w = new PacketWriter();

        // Extended packet header
        w.writeUInt8(0xD0);        // Extended packet opcode
        w.writeUInt16LE(0x21);     // RequestKeyMapping sub-opcode

        const body = w.toBuffer();
        Logger.logPacket('SEND', 0xD0, body);
        Logger.debug('RequestKeyMapping', `Encoded: opcode=0xD0 subOpcode=0x21, bodyLen=${body.length}`);
        return body;
    }
}
