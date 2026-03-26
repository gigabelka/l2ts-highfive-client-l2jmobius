/**
 * @fileoverview TargetUnselectedPacket - DTO для пакета TargetUnselected (0xA6)
 * Сброс выбора цели
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface TargetUnselectedData {
    targetId: number;
}

/**
 * Пакет TargetUnselected (0xA6)
 * Уведомление о сбросе выбора цели
 */
export class TargetUnselectedPacket implements IIncomingPacket {
    readonly opcode = 0xA6;
    private data!: TargetUnselectedData;

    decode(reader: IPacketReader): this {
        const targetId = reader.readInt32LE();

        this.data = {
            targetId,
        };

        return this;
    }

    getData(): TargetUnselectedData {
        return { ...this.data };
    }
}
