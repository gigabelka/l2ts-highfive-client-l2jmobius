/**
 * @fileoverview SpawnItemPacket - DTO для пакета SpawnItem (0x0B)
 * Появление предмета (дропа) в мире
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface SpawnItemData {
    objectId: number;
    itemId: number;
    x: number;
    y: number;
    z: number;
    stackable: boolean;
    count: number;
}

/**
 * Пакет SpawnItem (0x0B)
 * Предмет появился в мире (выпал из моба/игрока)
 */
export class SpawnItemPacket implements IIncomingPacket {
    readonly opcode = 0x0B;
    private data!: SpawnItemData;

    decode(reader: IPacketReader): this {
        const objectId = reader.readInt32LE();
        const itemId = reader.readInt32LE();
        const x = reader.readInt32LE();
        const y = reader.readInt32LE();
        const z = reader.readInt32LE();
        
        // Stackable flag (1 = stackable, 0 = not stackable)
        const stackable = reader.readInt32LE() !== 0;
        const count = reader.readInt64LE();

        this.data = {
            objectId,
            itemId,
            x,
            y,
            z,
            stackable,
            count: Number(count),
        };

        return this;
    }

    getData(): SpawnItemData {
        return { ...this.data };
    }
}
