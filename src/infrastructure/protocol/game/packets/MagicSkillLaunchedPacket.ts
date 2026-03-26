/**
 * @fileoverview MagicSkillLaunchedPacket - DTO для пакета MagicSkillLaunched (0x54)
 * Подтверждение запуска скилла
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface MagicSkillLaunchedData {
    casterObjectId: number;
    skillId: number;
    skillLevel: number;
    targetCount: number;
    targets: number[];
}

/**
 * Пакет MagicSkillLaunched
 * Подтверждение что скилл был успешно применён
 */
export class MagicSkillLaunchedPacket implements IIncomingPacket {
    readonly opcode = 0x54;
    private data!: MagicSkillLaunchedData;

    decode(reader: IPacketReader): this {
        const casterObjectId = reader.readInt32LE();
        const skillId = reader.readInt32LE();
        const skillLevel = reader.remaining() >= 4 ? reader.readInt32LE() : 1;
        const targetCount = reader.remaining() >= 4 ? reader.readInt32LE() : 0;
        const targets: number[] = [];

        for (let i = 0; i < targetCount && reader.remaining() >= 4; i++) {
            targets.push(reader.readInt32LE());
        }

        this.data = { casterObjectId, skillId, skillLevel, targetCount, targets };
        return this;
    }

    getData(): MagicSkillLaunchedData {
        return { ...this.data, targets: [...this.data.targets] };
    }
}
