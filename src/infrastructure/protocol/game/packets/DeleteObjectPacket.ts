/**
 * @fileoverview DeleteObjectPacket - DTO для пакета DeleteObject (0x08)
 * Удаление объекта из мира (деспавн NPC, игрока или предмета)
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface DeleteObjectData {
    objectId: number;
}

/**
 * Пакет DeleteObject (0x08)
 * Сервер уведомляет об исчезновении объекта из мира
 */
export class DeleteObjectPacket implements IIncomingPacket {
    readonly opcode = 0x08;
    private data!: DeleteObjectData;

    decode(reader: IPacketReader): this {
        const objectId = reader.readInt32LE();

        this.data = {
            objectId,
        };

        return this;
    }

    getData(): DeleteObjectData {
        return { ...this.data };
    }
}
