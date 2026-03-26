/**
 * @fileoverview ChangeMoveTypePacket - DTO для пакета ChangeMoveType (0x2e)
 * Смена типа движения (бег/ходьба)
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface ChangeMoveTypeData {
    objectId: number;
    isRunning: boolean;
}

/**
 * Пакет ChangeMoveType (0x28)
 * Переключение между бегом и ходьбой
 */
export class ChangeMoveTypePacket implements IIncomingPacket {
    readonly opcode = 0x28;
    private data!: ChangeMoveTypeData;

    decode(reader: IPacketReader): this {
        const objectId = reader.readInt32LE();
        const moveType = reader.readInt32LE();

        this.data = {
            objectId,
            isRunning: moveType === 1,
        };
        return this;
    }

    getData(): ChangeMoveTypeData {
        return { ...this.data };
    }
}
