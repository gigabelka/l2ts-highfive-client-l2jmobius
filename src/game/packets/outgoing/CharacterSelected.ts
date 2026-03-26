import { PacketWriter } from '../../../network/PacketWriter';
import { Logger } from '../../../logger/Logger';
import { OutgoingGamePacket } from './OutgoingGamePacket';
import { CONFIG } from '../../../config';

/**
 * CharacterSelect — select a character by slot index.
 *
 * OpCode: 0x0D for CT_0_Interlude (L2J Mobius specific + 14 bytes padding)
 *         0x36 for HighFive (standard L2 CharacterSelect)
 *
 * Format: slot index (4 bytes, LE) + optional padding
 */
export class CharacterSelected implements OutgoingGamePacket {
    private slotIndex: number;

    constructor(slotIndex: number) {
        this.slotIndex = slotIndex;
    }

    encode(): Buffer {
        const w = new PacketWriter();

        // Use different opcodes for different protocol versions
        // CT_0_Interlude (746) uses 0x0D, HighFive (267) uses 0x36
        const opcode = CONFIG.Protocol === 267 ? 0x36 : 0x0D;
        w.writeUInt8(opcode);
        w.writeInt32LE(this.slotIndex);  // slot index (4 bytes, LE)

        // CT_0_Interlude requires 14 bytes padding, HighFive typically doesn't
        if (CONFIG.Protocol === 746) {
            // 14 bytes padding for CT_0_Interlude
            for (let i = 0; i < 14; i++) {
                w.writeUInt8(0x00);
            }
        }

        const body = w.toBuffer();
        const protocolName = CONFIG.Protocol === 267 ? 'HighFive' : 'CT0_Interlude';
        Logger.logPacket('SEND', opcode, body);
        Logger.debug('CharacterSelected', `Encoded (${protocolName}): opcode=0x${opcode.toString(16)}, slot=${this.slotIndex}, bodyLen=${body.length}`);
        return body;
    }
}
