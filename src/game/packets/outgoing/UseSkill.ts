import { PacketWriter } from '../../../network/PacketWriter';
import { OutgoingGamePacket } from './OutgoingGamePacket';

/**
 * UseSkill (0x39) - Request to use a skill
 * 
 * Structure:
 * - skillId (uint32) - Skill ID
 * - ctrlPressed (uint8) - Ctrl key pressed (0/1)
 * - shiftPressed (uint8) - Shift key pressed (0/1)
 */
export class UseSkill implements OutgoingGamePacket {
    constructor(
        private skillId: number,
        private ctrlPressed: boolean = false,
        private shiftPressed: boolean = false
    ) {}

    encode(): Buffer {
        const writer = new PacketWriter();
        writer.writeUInt8(0x39); // Opcode
        writer.writeInt32LE(this.skillId);
        writer.writeUInt8(this.ctrlPressed ? 1 : 0);
        writer.writeUInt8(this.shiftPressed ? 1 : 0);
        return writer.toBuffer();
    }
}
