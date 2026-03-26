/**
 * @fileoverview DropItemPacket - DTO для пакета DropItem (0x0C)
 * Предмет выпал/брошен в мире
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface DropItemData {
    objectId: number;
    itemId: number;
    x: number;
    y: number;
    z: number;
    stackable: boolean;
    count: number;
    droppedById: number;
}

/**
 * Пакет DropItem (0x0C)
 * Предмет выпал из инвентаря или монстра
 */
export class DropItemPacket implements IIncomingPacket {
    readonly opcode = 0x0C;
    private data!: DropItemData;

    decode(reader: IPacketReader): this {
        const objectId = reader.readInt32LE();
        const itemId = reader.readInt32LE();
        const droppedById = reader.readInt32LE();
        const x = reader.readInt32LE();
        const y = reader.readInt32LE();
        const z = reader.readInt32LE();
        
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
            droppedById,
        };

        return this;
    }

    getData(): DropItemData {
        return { ...this.data };
    }
}
