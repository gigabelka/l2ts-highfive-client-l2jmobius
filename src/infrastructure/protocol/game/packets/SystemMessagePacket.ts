/**
 * @fileoverview SystemMessagePacket - DTO для пакета SystemMessage (0x62)
 * Системные сообщения от сервера
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface SystemMessageParam {
    type: number;
    value: string | number;
}

export interface SystemMessageData {
    messageId: number;
    params: SystemMessageParam[];
}

/**
 * Пакет SystemMessage (0x62)
 * Системные сообщения (получение предметов, урон, смена зоны и т.д.)
 */
export class SystemMessagePacket implements IIncomingPacket {
    readonly opcode = 0x62;
    private data!: SystemMessageData;

    decode(reader: IPacketReader): this {
        const messageId = reader.readInt32LE();
        const paramCount = reader.remaining() >= 4 ? reader.readInt32LE() : 0;
        const params: SystemMessageParam[] = [];

        for (let i = 0; i < paramCount && reader.remaining() >= 4; i++) {
            const type = reader.readInt32LE();
            let value: string | number;

            switch (type) {
                case 0: // Text
                case 2: // NPC name
                case 3: // Item name
                case 4: // Skill name
                    value = reader.remaining() >= 2 ? reader.readStringUTF16() : '';
                    break;
                case 1: // Number
                case 5: // Castle name
                case 6: // Number
                case 12: // Damage
                case 13: // Zone name
                default:
                    value = reader.remaining() >= 4 ? reader.readInt32LE() : 0;
                    break;
            }

            params.push({ type, value });
        }

        this.data = { messageId, params };
        return this;
    }

    getData(): SystemMessageData {
        return { ...this.data, params: [...this.data.params] };
    }
}
