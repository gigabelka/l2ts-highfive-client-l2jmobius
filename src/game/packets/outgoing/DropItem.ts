import { PacketWriter } from '../../../network/PacketWriter';
import { OutgoingGamePacket } from './OutgoingGamePacket';

/**
 * DropItem (0x17) - Request to drop an item on the ground
 * 
 * Structure:
 * - objectId (uint32) - Item object ID
 * - count (uint32) - Amount to drop
 * - x (int32) - Drop location X
 * - y (int32) - Drop location Y
 * - z (int32) - Drop location Z
 */
export class DropItem implements OutgoingGamePacket {
    constructor(
        private objectId: number,
        private count: number,
        private x: number,
        private y: number,
        private z: number
    ) {}

    encode(): Buffer {
        const writer = new PacketWriter();
        writer.writeUInt8(0x17); // Opcode
        writer.writeInt32LE(this.objectId);
        writer.writeInt32LE(this.count);
        writer.writeInt32LE(this.x);
        writer.writeInt32LE(this.y);
        writer.writeInt32LE(this.z);
        return writer.toBuffer();
    }
}
