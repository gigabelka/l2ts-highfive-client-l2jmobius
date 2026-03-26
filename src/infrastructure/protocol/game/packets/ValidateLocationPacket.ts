/**
 * @fileoverview ValidateLocationPacket - DTO для пакета ValidateLocation (0x61)
 * Серверная валидация позиции клиента
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface ValidateLocationData {
    objectId: number;
    x: number;
    y: number;
    z: number;
    heading: number;
}

/**
 * Пакет ValidateLocation (0x61)
 * Сервер подтверждает/корректирует позицию сущности
 */
export class ValidateLocationPacket implements IIncomingPacket {
    readonly opcode = 0x61;
    private data!: ValidateLocationData;

    decode(reader: IPacketReader): this {
        const objectId = reader.readInt32LE();
        const x = reader.readInt32LE();
        const y = reader.readInt32LE();
        const z = reader.readInt32LE();
        const heading = reader.remaining() >= 4 ? reader.readInt32LE() : 0;

        this.data = { objectId, x, y, z, heading };
        return this;
    }

    getData(): ValidateLocationData {
        return { ...this.data };
    }
}
