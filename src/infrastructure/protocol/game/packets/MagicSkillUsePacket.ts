/**
 * @fileoverview MagicSkillUsePacket - DTO для пакета MagicSkillUse (0x76)
 * Использование магического скила
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface MagicSkillUseData {
    activeCharId: number;      // ID кастера
    targetId: number;          // ID цели
    skillId: number;           // ID скила
    skillLevel: number;        // Уровень скила
    hitTime: number;           // Время каста (мс)
    reuseDelay: number;        // Задержка повторного использования (мс)
    x: number;                 // Позиция кастера X
    y: number;                 // Позиция кастера Y
    z: number;                 // Позиция кастера Z
    targetX: number;           // Позиция цели X
    targetY: number;           // Позиция цели Y
    targetZ: number;           // Позиция цели Z
}

/**
 * Пакет MagicSkillUse (0x76)
 * Уведомление об использовании магического скила
 */
export class MagicSkillUsePacket implements IIncomingPacket {
    readonly opcode = 0x76;
    private data!: MagicSkillUseData;

    decode(reader: IPacketReader): this {
        // Read mandatory fields (core skill use data)
        const activeCharId = reader.readInt32LE();
        const targetId = reader.readInt32LE();
        const skillId = reader.readInt32LE();

        // Read optional fields with bounds checking for protocol variations
        const skillLevel = reader.remaining() >= 4 ? reader.readInt32LE() : 1;
        const hitTime = reader.remaining() >= 4 ? reader.readInt32LE() : 0;
        const reuseDelay = reader.remaining() >= 4 ? reader.readInt32LE() : 0;

        // Read caster position (if available)
        const x = reader.remaining() >= 4 ? reader.readInt32LE() : 0;
        const y = reader.remaining() >= 4 ? reader.readInt32LE() : 0;
        const z = reader.remaining() >= 4 ? reader.readInt32LE() : 0;

        // Read target position (if available)
        const targetX = reader.remaining() >= 4 ? reader.readInt32LE() : 0;
        const targetY = reader.remaining() >= 4 ? reader.readInt32LE() : 0;
        const targetZ = reader.remaining() >= 4 ? reader.readInt32LE() : 0;

        this.data = {
            activeCharId,
            targetId,
            skillId,
            skillLevel,
            hitTime,
            reuseDelay,
            x,
            y,
            z,
            targetX,
            targetY,
            targetZ,
        };

        return this;
    }

    getData(): MagicSkillUseData {
        return { ...this.data };
    }

    /**
     * Проверить, является ли кастер игроком
     */
    isPlayerCaster(playerId: number): boolean {
        return this.data.activeCharId === playerId;
    }

    /**
     * Проверить, является ли цель игроком
     */
    isPlayerTarget(playerId: number): boolean {
        return this.data.targetId === playerId;
    }
}
