/**
 * @fileoverview TargetSelectedPacket - DTO для пакета TargetSelected (0x29)
 * Выбор цели другим игроком/NPC
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface TargetSelectedData {
    objectId: number;
    targetId: number;
    x: number;
    y: number;
    z: number;
}

/**
 * Пакет TargetSelected (0x29)
 * Уведомление о выборе цели
 */
export class TargetSelectedPacket implements IIncomingPacket {
    readonly opcode = 0x29;
    private data!: TargetSelectedData;

    decode(reader: IPacketReader): this {
        const objectId = reader.readInt32LE();
        const targetId = reader.readInt32LE();
        const x = reader.remaining() >= 4 ? reader.readInt32LE() : 0;
        const y = reader.remaining() >= 4 ? reader.readInt32LE() : 0;
        const z = reader.remaining() >= 4 ? reader.readInt32LE() : 0;

        this.data = { objectId, targetId, x, y, z };
        return this;
    }

    getData(): TargetSelectedData {
        return { ...this.data };
    }
}
