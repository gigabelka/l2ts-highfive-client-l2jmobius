import { PacketWriter } from '../../../network/PacketWriter';
import { OutgoingGamePacket } from './OutgoingGamePacket';

/**
 * MoveToLocation (0x01) - Request to move to specific coordinates
 * 
 * Structure (from l2J-Mobius MoveToLocation.java):
 * - targetX (int32)
 * - targetY (int32) 
 * - targetZ (int32)
 * - originX (int32)
 * - originY (int32)
 * - originZ (int32)
 * - movementMode (int32) - 0=cursor keys, 1=mouse click
 */
export class MoveToLocation implements OutgoingGamePacket {
    constructor(
        private targetX: number,
        private targetY: number,
        private targetZ: number,
        private originX: number,
        private originY: number,
        private originZ: number,
        private movementMode: number = 1 // 1 = mouse click by default
    ) {}

    encode(): Buffer {
        const writer = new PacketWriter();
        writer.writeUInt8(0x01); // Opcode
        writer.writeInt32LE(this.targetX);
        writer.writeInt32LE(this.targetY);
        writer.writeInt32LE(this.targetZ);
        writer.writeInt32LE(this.originX);
        writer.writeInt32LE(this.originY);
        writer.writeInt32LE(this.originZ);
        writer.writeInt32LE(this.movementMode);
        return writer.toBuffer();
    }
}
