/**
 * @fileoverview GetItemPacket - DTO для пакета GetItem (0x0d)
 * Подбор предмета с земли
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface GetItemData {
    objectId: number;
    itemObjectId: number;
    x: number;
    y: number;
    z: number;
}

/**
 * Пакет GetItem (0x0d)
 * Анимация подбора предмета
 */
export class GetItemPacket implements IIncomingPacket {
    readonly opcode = 0x0d;
    private data!: GetItemData;

    decode(reader: IPacketReader): this {
        const objectId = reader.readInt32LE();
        const itemObjectId = reader.readInt32LE();
        const x = reader.remaining() >= 4 ? reader.readInt32LE() : 0;
        const y = reader.remaining() >= 4 ? reader.readInt32LE() : 0;
        const z = reader.remaining() >= 4 ? reader.readInt32LE() : 0;

        this.data = { objectId, itemObjectId, x, y, z };
        return this;
    }

    getData(): GetItemData {
        return { ...this.data };
    }
}
