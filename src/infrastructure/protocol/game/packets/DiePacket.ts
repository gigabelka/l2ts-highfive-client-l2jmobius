/**
 * @fileoverview DiePacket - DTO для пакета Die (0x06)
 * Смерть сущности (игрока или NPC)
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface DieData {
    objectId: number;
    // Дополнительные поля могут включать:
    // - boolean: можно ли использовать фиксированный рез
    // - int: задержка перед возможностью резнуть
}

/**
 * Пакет Die (0x06)
 * Уведомление о смерти сущности
 */
export class DiePacket implements IIncomingPacket {
    readonly opcode = 0x06;
    private data!: DieData;

    decode(reader: IPacketReader): this {
        const objectId = reader.readInt32LE();

        // В Interlude базовый пакет содержит только objectId
        // Некоторые версии могут иметь дополнительные поля
        this.data = {
            objectId,
        };

        return this;
    }

    getData(): DieData {
        return { ...this.data };
    }
}
