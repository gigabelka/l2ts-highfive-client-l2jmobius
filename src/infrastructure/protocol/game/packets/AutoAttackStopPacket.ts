/**
 * @fileoverview AutoAttackStopPacket - DTO для пакета AutoAttackStop (0x26)
 * Окончание автоатаки
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface AutoAttackStopData {
    targetObjectId: number;
}

/**
 * Пакет AutoAttackStop
 * Уведомление об окончании автоатаки
 */
export class AutoAttackStopPacket implements IIncomingPacket {
    readonly opcode = 0x26;
    private data!: AutoAttackStopData;

    decode(reader: IPacketReader): this {
        const targetObjectId = reader.remaining() >= 4 ? reader.readInt32LE() : 0;
        this.data = { targetObjectId };
        return this;
    }

    getData(): AutoAttackStopData {
        return { ...this.data };
    }
}
