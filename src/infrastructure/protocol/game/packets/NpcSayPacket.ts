/**
 * @fileoverview NpcSayPacket - DTO для пакета NpcSay (0x02)
 * Сообщение от NPC в чат
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface NpcSayData {
    objectId: number;
    messageType: number;
    npcId: number;
    message: string;
}

/**
 * Пакет NpcSay (0x02)
 * NPC говорит сообщение
 */
export class NpcSayPacket implements IIncomingPacket {
    readonly opcode = 0x02;
    private data!: NpcSayData;

    decode(reader: IPacketReader): this {
        const objectId = reader.readInt32LE();
        const messageType = reader.readInt32LE();
        const npcId = reader.remaining() >= 4 ? reader.readInt32LE() : 0;
        const message = reader.remaining() >= 2 ? reader.readStringUTF16() : '';

        this.data = { objectId, messageType, npcId, message };
        return this;
    }

    getData(): NpcSayData {
        return { ...this.data };
    }
}
