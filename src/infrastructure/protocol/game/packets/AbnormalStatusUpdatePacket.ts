/**
 * @fileoverview AbnormalStatusUpdatePacket - DTO для пакета AbnormalStatusUpdate (0x39)
 * Обновление абнормальных статусов (баффы и дебаффы)
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface AbnormalEffect {
    skillId: number;
    effectId: number;  // Обычно skillId + уровень
    duration: number;  // Оставшееся время в секундах
}

export interface AbnormalStatusUpdateData {
    effects: AbnormalEffect[];
}

/**
 * Пакет AbnormalStatusUpdate (0x39)
 * Обновление списка активных эффектов (баффы/дебаффы)
 */
export class AbnormalStatusUpdatePacket implements IIncomingPacket {
    readonly opcode = 0x39;
    private data!: AbnormalStatusUpdateData;

    decode(reader: IPacketReader): this {
        const effectCount = reader.readInt16LE();
        const effects: AbnormalEffect[] = [];

        for (let i = 0; i < effectCount; i++) {
            const skillId = reader.readInt16LE();
            const effectId = reader.readInt16LE();
            const duration = reader.readInt32LE();

            effects.push({
                skillId,
                effectId,
                duration,
            });
        }

        this.data = {
            effects,
        };

        return this;
    }

    getData(): AbnormalStatusUpdateData {
        return { ...this.data, effects: [...this.data.effects] };
    }

    /**
     * Получить активные баффы (обычно положительные эффекты)
     */
    getBuffs(): AbnormalEffect[] {
        // Баффы обычно имеют skillId < 2000 или определённые диапазоны
        return this.data.effects.filter(e => e.skillId < 2000);
    }

    /**
     * Получить дебаффы (отрицательные эффекты)
     */
    getDebuffs(): AbnormalEffect[] {
        return this.data.effects.filter(e => e.skillId >= 2000);
    }
}
