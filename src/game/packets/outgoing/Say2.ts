import { PacketWriter } from '../../../network/PacketWriter';
import { OutgoingGamePacket } from './OutgoingGamePacket';

/**
 * Say2 (0x38) - Send chat message
 * 
 * Structure (from l2J-Mobius Say2.java):
 * - text (UTF16-LE string, null-terminated)
 * - type (int32) - Chat type
 * - target (UTF16-LE string, null-terminated) - Only for whisper
 */
export class Say2 implements OutgoingGamePacket {
    constructor(
        private text: string,
        private type: ChatType = ChatType.ALL,
        private target: string = ''
    ) {}

    encode(): Buffer {
        const writer = new PacketWriter();
        writer.writeUInt8(0x38); // Opcode
        writer.writeStringNullUTF16(this.text);
        writer.writeInt32LE(this.type);
        
        // Target only for whisper
        if (this.type === ChatType.WHISPER) {
            writer.writeStringNullUTF16(this.target);
        }
        
        return writer.toBuffer();
    }
}

// Chat type IDs (from client perspective)
export enum ChatType {
    ALL = 0,
    SHOUT = 1,
    TELL = 2,
    PARTY = 3,
    CLAN = 4,
    GM = 5,
    PETITION_PLAYER = 6,
    PETITION_GM = 7,
    TRADE = 8,
    ALLIANCE = 9,
    ANNOUNCEMENT = 10,
    BOAT = 11,
    L2FRIEND = 12,
    MSNCHAT = 13,
    PARTYMATCH_ROOM = 14,
    PARTYROOM_COMMANDER = 15,
    PARTYROOM_ALL = 16,
    HERO_VOICE = 17,
    CRITICAL_ANNOUNCE = 18,
    SCREEN_ANNOUNCE = 19,
    BATTLEFIELD = 20,
    MPCC_ROOM = 21,
    NPC_ALL = 22,
    NPC_SHOUT = 23,
    WHISPER = 24
}
