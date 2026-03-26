/**
 * @fileoverview NpcHtmlMessagePacket - DTO для пакета NpcHtmlMessage (0x0f)
 * HTML диалог от NPC
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface NpcHtmlMessageData {
    npcObjectId: number;
    html: string;
    itemId: number;
}

/**
 * Пакет NpcHtmlMessage
 * HTML окно от NPC (диалоги, магазины, квесты)
 */
export class NpcHtmlMessagePacket implements IIncomingPacket {
    readonly opcode = 0x0f;
    private data!: NpcHtmlMessageData;

    decode(reader: IPacketReader): this {
        const npcObjectId = reader.readInt32LE();
        const html = reader.remaining() >= 2 ? reader.readStringUTF16() : '';
        const itemId = reader.remaining() >= 4 ? reader.readInt32LE() : 0;

        this.data = { npcObjectId, html, itemId };
        return this;
    }

    getData(): NpcHtmlMessageData {
        return { ...this.data };
    }
}
