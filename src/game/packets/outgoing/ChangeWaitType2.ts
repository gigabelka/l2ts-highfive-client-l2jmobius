import { PacketWriter } from '../../../network/PacketWriter';
import { OutgoingGamePacket } from './OutgoingGamePacket';

/**
 * ChangeWaitType2 (0x1D) - Sit/Stand toggle
 * 
 * Structure:
 * - typeStand (int32) - 0=Sit, 1=Stand
 */
export class ChangeWaitType2 implements OutgoingGamePacket {
    constructor(private typeStand: boolean) {}

    encode(): Buffer {
        const writer = new PacketWriter();
        writer.writeUInt8(0x1D); // Opcode
        writer.writeInt32LE(this.typeStand ? 1 : 0);
        return writer.toBuffer();
    }
}
