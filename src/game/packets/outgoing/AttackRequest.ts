import { PacketWriter } from '../../../network/PacketWriter';
import { OutgoingGamePacket } from './OutgoingGamePacket';

/**
 * AttackRequest (0x0A) - Request to attack a target
 * 
 * Structure (from l2J-Mobius AttackRequest.java):
 * - objectId (int32) - Target object ID
 * - originX (int32) - Player X position
 * - originY (int32) - Player Y position  
 * - originZ (int32) - Player Z position
 * - attackId (byte) - 0=simple click, 1=shift-click
 */
export class AttackRequest implements OutgoingGamePacket {
    constructor(
        private objectId: number,
        private originX: number,
        private originY: number,
        private originZ: number,
        private shiftClick: boolean = false
    ) {}

    encode(): Buffer {
        const writer = new PacketWriter();
        writer.writeUInt8(0x0A); // Opcode
        writer.writeInt32LE(this.objectId);
        writer.writeInt32LE(this.originX);
        writer.writeInt32LE(this.originY);
        writer.writeInt32LE(this.originZ);
        writer.writeUInt8(this.shiftClick ? 1 : 0);
        return writer.toBuffer();
    }
}
