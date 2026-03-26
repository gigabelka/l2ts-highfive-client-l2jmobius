/**
 * @fileoverview AutoAttackStartPacket - DTO для пакета AutoAttackStart (0x25)
 * Начало автоатаки
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface AutoAttackStartData {
    targetObjectId: number;
}

/**
 * Пакет AutoAttackStart
 * Уведомление о начале автоатаки
 */
export class AutoAttackStartPacket implements IIncomingPacket {
    readonly opcode = 0x25;
    private data!: AutoAttackStartData;

    decode(reader: IPacketReader): this {
        const targetObjectId = reader.remaining() >= 4 ? reader.readInt32LE() : 0;
        this.data = { targetObjectId };
        return this;
    }

    getData(): AutoAttackStartData {
        return { ...this.data };
    }
}
