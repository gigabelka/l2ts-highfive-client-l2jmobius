import { PacketWriter } from '../../../network/PacketWriter';
import { Logger } from '../../../logger/Logger';
import { OutgoingGamePacket } from './OutgoingGamePacket';
import { CONFIG } from '../../../config';

/**
 * EnterWorld — request to enter game world.
 *
 * OpCode: 0x03 for CT_0_Interlude (L2J Mobius specific with 104 bytes padding)
 *         0x11 for HighFive (standard L2 EnterWorld)
 *
 * Note: CT_0 requires special 3-packet sequence, handled in GameClient.
 */
export class EnterWorld implements OutgoingGamePacket {
    encode(): Buffer {
        const w = new PacketWriter();

        // Use different opcodes for different protocol versions
        // CT_0_Interlude (746) uses 0x03, HighFive (267) uses 0x11
        const opcode = CONFIG.Protocol === 267 ? 0x11 : 0x03;
        w.writeUInt8(opcode);

        // CT_0_Interlude requires 104 bytes padding, HighFive typically doesn't
        if (CONFIG.Protocol === 746) {
            // 104 bytes padding for CT_0_Interlude
            for (let i = 0; i < 104; i++) {
                w.writeUInt8(0x00);
            }
        }

        const body = w.toBuffer();
        const protocolName = CONFIG.Protocol === 267 ? 'HighFive' : 'CT0_Mobius';
        Logger.logPacket('SEND', opcode, body);
        Logger.debug('EnterWorld', `Encoded (${protocolName}): opcode=0x${opcode.toString(16)}, bodyLen=${body.length}`);
        return body;
    }
}