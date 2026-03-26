import { PacketWriter } from '../../../network/PacketWriter';
import { Logger } from '../../../logger/Logger';
import { OutgoingGamePacket } from './OutgoingGamePacket';
import { CONFIG } from '../../../config';

/**
 * ProtocolVersion — first packet sent to game server.
 *
 * OpCode: 0x00 for CT_0_Interlude (L2J Mobius specific)
 *         0x0E for HighFive (standard L2 protocol)
 *
 * Format: opcode (1 byte) + protocol version (4 bytes INT32)
 */
export class ProtocolVersion implements OutgoingGamePacket {
    encode(): Buffer {
        const w = new PacketWriter();

        // Use different opcodes for different protocol versions
        // CT_0_Interlude (746) uses 0x00, HighFive (267) uses 0x0E
        const opcode = CONFIG.Protocol === 267 ? 0x0E : 0x00;
        w.writeUInt8(opcode);

        w.writeInt32LE(CONFIG.Protocol);  // Protocol version as INT32
        const body = w.toBuffer();
        Logger.logPacket('SEND', opcode, body);
        Logger.debug('ProtocolVersion', `Encoded: opcode=0x${opcode.toString(16)}, protocol=${CONFIG.Protocol}, bodyLen=${body.length}`);
        return body;
    }

    /** Create packet - just protocol version */
    static encodeWithSession(): Buffer {
        const w = new PacketWriter();

        // Use different opcodes for different protocol versions
        // CT_0_Interlude (746) uses 0x00, HighFive (267) uses 0x0E
        const opcode = CONFIG.Protocol === 267 ? 0x0E : 0x00;
        w.writeUInt8(opcode);

        w.writeInt32LE(CONFIG.Protocol);  // Protocol version as INT32 (4 bytes!)

        const body = w.toBuffer();
        Logger.logPacket('SEND', opcode, body);
        Logger.debug('ProtocolVersion', `Static encoded: opcode=0x${opcode.toString(16)}, protocol=${CONFIG.Protocol}, bodyLen=${body.length}`);
        return body;
    }
}
