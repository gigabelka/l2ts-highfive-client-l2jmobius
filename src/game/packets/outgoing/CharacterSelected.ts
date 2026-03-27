import { PacketWriter } from '../../../network/PacketWriter';
import { Logger } from '../../../logger/Logger';
import { OutgoingGamePacket } from './OutgoingGamePacket';
import { CONFIG, isCurrentProtocolHighFive } from '../../../config';

/**
 * CharacterSelect — select a character by slot index.
 *
 * OpCode: 0x0D for CT_0_Interlude (L2J Mobius specific + 14 bytes padding)
 *         0x12 for HighFive (L2J Mobius CT 2.6 + 14 bytes padding)
 *
 * Format: slot index (4 bytes, LE) + 14 bytes padding (required for both protocols)
 */
export class CharacterSelected implements OutgoingGamePacket {
    private slotIndex: number;

    constructor(slotIndex: number) {
        this.slotIndex = slotIndex;
    }

    encode(): Buffer {
        const w = new PacketWriter();

        // Use different opcodes for different protocol versions
        // CT_0_Interlude (746) uses 0x0D, HighFive (267) uses 0x12 (L2J Mobius CT 2.6)
        const opcode = isCurrentProtocolHighFive() ? 0x12 : 0x0D;
        w.writeUInt8(opcode);
        w.writeInt32LE(this.slotIndex);  // slot index (4 bytes, LE)

        // Both CT_0_Interlude and HighFive require 14 bytes padding based on working session analysis
        if (CONFIG.Protocol === 746 || isCurrentProtocolHighFive()) {
            // 14 bytes padding - required for both CT_0_Interlude and HighFive
            for (let i = 0; i < 14; i++) {
                w.writeUInt8(0x00);
            }
        }

        const body = w.toBuffer();
        const protocolName = isCurrentProtocolHighFive() ? 'HighFive' : 'CT0_Interlude';
        Logger.logPacket('SEND', opcode, body);
        Logger.debug('CharacterSelected', `Encoded (${protocolName}): opcode=0x${opcode.toString(16)}, slot=${this.slotIndex}, bodyLen=${body.length}`);
        return body;
    }
}
