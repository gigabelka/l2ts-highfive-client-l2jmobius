/**
 * @fileoverview MyTargetSelectedPacket - DTO для пакета MyTargetSelected (0xA1)
 * Выбор цели (мой персонаж выбрал цель)
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface MyTargetSelectedData {
    targetId: number;
}

/**
 * Пакет MyTargetSelected (0xA1)
 * Уведомление о выборе цели персонажем
 */
export class MyTargetSelectedPacket implements IIncomingPacket {
    readonly opcode = 0xA1;
    private data!: MyTargetSelectedData;

    decode(reader: IPacketReader): this {
        const targetId = reader.readInt32LE();

        this.data = {
            targetId,
        };

        return this;
    }

    getData(): MyTargetSelectedData {
        return { ...this.data };
    }
}
