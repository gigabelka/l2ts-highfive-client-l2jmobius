/**
 * src/game/packets/outgoing/RequestInventoryOpen.ts
 * 
 * RequestInventoryOpen (0x15) - Client to Server
 * Запрос открытия/обновления инвентаря
 * 
 * Interlude protocol - packet has no body, just opcode
 */

import { PacketWriter } from '../../../network/PacketWriter';
import { OutgoingGamePacket } from './OutgoingGamePacket';

export class RequestInventoryOpen implements OutgoingGamePacket {
    public static readonly OPCODE = 0x15;

    encode(): Buffer {
        const w = new PacketWriter();
        w.writeUInt8(RequestInventoryOpen.OPCODE);
        return w.toBuffer();
    }
}
