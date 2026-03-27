import { PacketWriter } from '../../../network/PacketWriter';
import { Logger } from '../../../logger/Logger';
import { OutgoingGamePacket } from './OutgoingGamePacket';
import { isCurrentProtocolHighFive } from '../../../config';

/**
 * EnterWorld — request to enter game world.
 *
 * OpCode: 0x03 for CT_0_Interlude (L2J Mobius specific with 104 bytes padding)
 *         0x11 for HighFive (standard L2 EnterWorld)
 *
 * Note: L2J Mobius explicitly expects exactly 104 bytes of padding payload
 * for both CT_0_Interlude (746) and HighFive (267/273) to avoid BufferUnderflowException.
 */
export class EnterWorld implements OutgoingGamePacket {
    encode(): Buffer {
        const w = new PacketWriter();

        // Use different opcodes for different protocol versions
        // CT_0_Interlude (746) uses 0x03, HighFive (267) uses 0x11
        const opcode = isCurrentProtocolHighFive() ? 0x11 : 0x03;
        w.writeUInt8(opcode);

        // Both CT_0_Interlude and HighFive in L2J Mobius require exactly 104 bytes padding
        // This is used for hardware info/tracert parsing in the server
        for (let i = 0; i < 104; i++) {
            w.writeUInt8(0x00);
        }

        const body = w.toBuffer();
        const protocolName = isCurrentProtocolHighFive() ? 'HighFive' : 'CT0_Mobius';
        Logger.logPacket('SEND', opcode, body);
        Logger.debug('EnterWorld', `Encoded (${protocolName}): opcode=0x${opcode.toString(16)}, bodyLen=${body.length}`);
        return body;
    }
}