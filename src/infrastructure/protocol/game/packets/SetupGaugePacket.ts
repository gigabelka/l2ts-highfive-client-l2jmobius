/**
 * @fileoverview SetupGaugePacket - DTO для пакета SetupGauge (0x6d)
 * Прогрессбар (каст скилла, подбор предмета и т.д.)
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface SetupGaugeData {
    objectId: number;
    color: number; // 0=blue, 1=red, 2=cyan
    currentTime: number;
    maxTime: number;
}

/**
 * Пакет SetupGauge
 * Отображение полоски прогресса (каст, сбор и т.д.)
 */
export class SetupGaugePacket implements IIncomingPacket {
    readonly opcode = 0x6d;
    private data!: SetupGaugeData;

    decode(reader: IPacketReader): this {
        const objectId = reader.readInt32LE();
        const color = reader.readInt32LE();
        const currentTime = reader.remaining() >= 4 ? reader.readInt32LE() : 0;
        const maxTime = reader.remaining() >= 4 ? reader.readInt32LE() : 0;

        this.data = { objectId, color, currentTime, maxTime };
        return this;
    }

    getData(): SetupGaugeData {
        return { ...this.data };
    }
}
