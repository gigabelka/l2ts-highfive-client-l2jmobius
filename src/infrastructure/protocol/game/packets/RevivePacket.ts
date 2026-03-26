/**
 * @fileoverview RevivePacket - DTO для пакета Revive (0x07)
 * Воскрешение сущности (игрока или NPC)
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface ReviveData {
    objectId: number;
}

/**
 * Пакет Revive (0x07)
 * Уведомление о воскрешении сущности
 */
export class RevivePacket implements IIncomingPacket {
    readonly opcode = 0x07;
    private data!: ReviveData;

    decode(reader: IPacketReader): this {
        const objectId = reader.readInt32LE();

        this.data = {
            objectId,
        };

        return this;
    }

    getData(): ReviveData {
        return { ...this.data };
    }
}
