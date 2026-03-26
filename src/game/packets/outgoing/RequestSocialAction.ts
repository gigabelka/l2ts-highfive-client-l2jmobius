import { PacketWriter } from '../../../network/PacketWriter';
import { OutgoingGamePacket } from './OutgoingGamePacket';

/**
 * RequestSocialAction (0x1B) - Perform social action (sit, stand, etc.)
 * 
 * Structure (from l2J-Mobius RequestSocialAction.java):
 * - actionId (int32)
 * 
 * Action IDs:
 * 1: Stand/Sit toggle
 * 2: Greeting
 * 3: Victory
 * 4: Advance
 * 5: No
 * 6: Yes
 * 7: Bow
 * 8: Unaware
 * 9: Waiting
 * 10: Laugh
 * 11: Think
 * 12: Applaud
 * 13: Dance
 */
export class RequestSocialAction implements OutgoingGamePacket {
    constructor(private actionId: number) {}

    encode(): Buffer {
        const writer = new PacketWriter();
        writer.writeUInt8(0x1B); // Opcode
        writer.writeInt32LE(this.actionId);
        return writer.toBuffer();
    }
}

// Common social action IDs
export const SocialActions = {
    STAND_SIT: 1,
    GREETING: 2,
    VICTORY: 3,
    ADVANCE: 4,
    NO: 5,
    YES: 6,
    BOW: 7,
    UNAWARE: 8,
    WAITING: 9,
    LAUGH: 10,
    THINK: 11,
    APPLAUD: 12,
    DANCE: 13
} as const;
