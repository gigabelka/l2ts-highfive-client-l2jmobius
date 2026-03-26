import { PacketWriter } from '../../../network/PacketWriter';
import { OutgoingGamePacket } from './OutgoingGamePacket';

/**
 * Action (0x04) - Interact with object (select target, open dialog, etc.)
 * 
 * Structure (from l2J-Mobius Action.java):
 * - objectId (int32) - Target object ID
 * - originX (int32) - Player X position
 * - originY (int32) - Player Y position
 * - originZ (int32) - Player Z position
 * - actionId (byte) - 0=simple click, 1=shift click
 */
export class Action implements OutgoingGamePacket {
    constructor(
        private objectId: number,
        private originX: number,
        private originY: number,
        private originZ: number,
        private shiftClick: boolean = false
    ) {}

    encode(): Buffer {
        const writer = new PacketWriter();
        writer.writeUInt8(0x04); // Opcode
        writer.writeInt32LE(this.objectId);
        writer.writeInt32LE(this.originX);
        writer.writeInt32LE(this.originY);
        writer.writeInt32LE(this.originZ);
        writer.writeUInt8(this.shiftClick ? 1 : 0);
        return writer.toBuffer();
    }
}
