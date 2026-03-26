import { PacketWriter } from '../../../network/PacketWriter';
import { OutgoingGamePacket } from './OutgoingGamePacket';

/**
 * RequestJoinParty (0x29) - Request to invite a player to party
 * 
 * Structure:
 * - playerName (UTF-16LE string) - Target player name
 */
export class RequestJoinParty implements OutgoingGamePacket {
    constructor(
        private playerName: string
    ) {}

    encode(): Buffer {
        const writer = new PacketWriter();
        writer.writeUInt8(0x29); // Opcode
        writer.writeStringNullUTF16(this.playerName);
        return writer.toBuffer();
    }
}
