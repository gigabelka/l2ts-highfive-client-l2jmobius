import { PacketWriter } from '../../../network/PacketWriter';
import { OutgoingGamePacket } from './OutgoingGamePacket';

/**
 * UseItem (0x14) - Request to use an item
 * 
 * Structure:
 * - objectId (uint32) - Item object ID
 */
export class UseItem implements OutgoingGamePacket {
    constructor(
        private objectId: number
    ) {}

    encode(): Buffer {
        const writer = new PacketWriter();
        writer.writeUInt8(0x14); // Opcode
        writer.writeInt32LE(this.objectId);
        return writer.toBuffer();
    }
}
