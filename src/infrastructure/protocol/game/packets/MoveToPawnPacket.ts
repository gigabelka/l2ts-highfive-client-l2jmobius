/**
 * @fileoverview MoveToPawnPacket - DTO для пакета MoveToPawn (0x60)
 * Движение к целевому объекту (следование)
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface MoveToPawnData {
    objectId: number;
    targetId: number;
    distance: number;
    x: number;
    y: number;
    z: number;
    targetX: number;
    targetY: number;
    targetZ: number;
}

/**
 * Пакет MoveToPawn (0x60)
 * Сущность движется к другой сущности (следование за целью)
 */
export class MoveToPawnPacket implements IIncomingPacket {
    readonly opcode = 0x60;
    private data!: MoveToPawnData;

    decode(reader: IPacketReader): this {
        const objectId = reader.readInt32LE();
        const targetId = reader.readInt32LE();
        const distance = reader.remaining() >= 4 ? reader.readInt32LE() : 0;
        const x = reader.remaining() >= 4 ? reader.readInt32LE() : 0;
        const y = reader.remaining() >= 4 ? reader.readInt32LE() : 0;
        const z = reader.remaining() >= 4 ? reader.readInt32LE() : 0;
        const targetX = reader.remaining() >= 4 ? reader.readInt32LE() : 0;
        const targetY = reader.remaining() >= 4 ? reader.readInt32LE() : 0;
        const targetZ = reader.remaining() >= 4 ? reader.readInt32LE() : 0;

        this.data = { objectId, targetId, distance, x, y, z, targetX, targetY, targetZ };
        return this;
    }

    getData(): MoveToPawnData {
        return { ...this.data };
    }
}
