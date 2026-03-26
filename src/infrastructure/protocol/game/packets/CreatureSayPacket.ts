/**
 * @fileoverview CreatureSayPacket - DTO для пакета CreatureSay (0x4A)
 * Сообщение в чате от существа (игрока, NPC)
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export type ChatMessageType =
    | 0x00  // ALL
    | 0x01  // SHOUT
    | 0x02  // TELL
    | 0x03  // PARTY
    | 0x04  // CLAN
    | 0x05  // GAMEMASTER
    | 0x06  // PETITION_PLAYER
    | 0x07  // PETITION_GM
    | 0x08  // TRADE
    | 0x09  // ALLIANCE
    | 0x0A  // ANNOUNCEMENT
    | 0x0B  // BOT
    | 0x0C; // HERO_VOICE

export interface CreatureSayData {
    objectId: number;
    messageType: ChatMessageType;
    senderName: string;
    message: string;
}

/**
 * Пакет CreatureSay (0x4A)
 * Сообщение в чате
 */
export class CreatureSayPacket implements IIncomingPacket {
    readonly opcode = 0x4A;
    private data!: CreatureSayData;

    decode(reader: IPacketReader): this {
        const objectId = reader.readInt32LE();
        const messageType = reader.readInt32LE() as ChatMessageType;
        const senderName = reader.readStringUTF16();
        const message = reader.readStringUTF16();

        this.data = {
            objectId,
            messageType,
            senderName,
            message,
        };

        return this;
    }

    getData(): CreatureSayData {
        return { ...this.data };
    }

    /**
     * Получить тип сообщения как строку
     */
    getMessageTypeString(): string {
        const types: Record<ChatMessageType, string> = {
            0x00: 'ALL',
            0x01: 'SHOUT',
            0x02: 'TELL',
            0x03: 'PARTY',
            0x04: 'CLAN',
            0x05: 'GAMEMASTER',
            0x06: 'PETITION_PLAYER',
            0x07: 'PETITION_GM',
            0x08: 'TRADE',
            0x09: 'ALLIANCE',
            0x0A: 'ANNOUNCEMENT',
            0x0B: 'BOT',
            0x0C: 'HERO_VOICE',
        };
        return types[this.data.messageType] || 'UNKNOWN';
    }
}
