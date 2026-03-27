/**
 * src/game/packets/outgoing/RequestInventoryOpen.ts
 * 
 * RequestInventoryOpen / RequestItemList
 * CT_0_Interlude: 0x15
 * HighFive (L2J Mobius CT 2.6): 0x14 (REQUEST_ITEM_LIST)
 * 
 * Interlude protocol - packet has no body, just opcode
 */

import { PacketWriter } from '../../../network/PacketWriter';
import { OutgoingGamePacket } from './OutgoingGamePacket';
import { isCurrentProtocolHighFive } from '../../../config';

export class RequestInventoryOpen implements OutgoingGamePacket {
    // CT_0_Interlude: 0x15, HighFive: 0x14
    public static get OPCODE(): number {
        return isCurrentProtocolHighFive() ? 0x14 : 0x15;
    }

    encode(): Buffer {
        const w = new PacketWriter();
        w.writeUInt8(RequestInventoryOpen.OPCODE);
        return w.toBuffer();
    }
}
