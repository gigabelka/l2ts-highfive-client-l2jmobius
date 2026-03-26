/**
 * @fileoverview MoveToLocationPacket - DTO для пакета MoveToLocation (0x2E)
 * Движение сущности к указанной позиции
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface MoveToLocationData {
    objectId: number;
    targetX: number;
    targetY: number;
    targetZ: number;
    originX: number;
    originY: number;
    originZ: number;
    moveSpeed: number;
}

/**
 * Пакет MoveToLocation (0x2E)
 * Уведомление о начале движения сущности
 * 
 * L2J Mobius CT0 Interlude format (варьируется):
 * - objectId: int32 (4 bytes)
 * - targetX: int32 (4 bytes) - опционально
 * - targetY: int32 (4 bytes) - опционально
 * - targetZ: int32 (4 bytes) - опционально
 * - originX/Y/Z: int32 each - опционально
 * - moveSpeed: int32 - опционально
 * 
 * Минимальный размер: 4 байта (только objectId)
 */
export class MoveToLocationPacket implements IIncomingPacket {
    readonly opcode = 0x2E;
    private data!: MoveToLocationData;

    decode(reader: IPacketReader): this {
        // Всегда есть objectId (минимум 4 байта)
        const objectId = reader.readInt32LE();
        
        // Остальные поля опциональны - проверяем наличие данных перед чтением
        const targetX = reader.remaining() >= 4 ? reader.readInt32LE() : 0;
        const targetY = reader.remaining() >= 4 ? reader.readInt32LE() : 0;
        const targetZ = reader.remaining() >= 4 ? reader.readInt32LE() : 0;
        
        // Origin координаты (опционально)
        const originX = reader.remaining() >= 4 ? reader.readInt32LE() : targetX;
        const originY = reader.remaining() >= 4 ? reader.readInt32LE() : targetY;
        const originZ = reader.remaining() >= 4 ? reader.readInt32LE() : targetZ;
        
        // Move speed (optional)
        const moveSpeed = reader.remaining() >= 4 ? reader.readInt32LE() : 0;

        this.data = {
            objectId,
            targetX,
            targetY,
            targetZ,
            originX,
            originY,
            originZ,
            moveSpeed,
        };

        return this;
    }

    getData(): MoveToLocationData {
        return { ...this.data };
    }

    /**
     * Рассчитать дистанцию перемещения
     */
    getDistance(): number {
        const dx = this.data.targetX - this.data.originX;
        const dy = this.data.targetY - this.data.originY;
        const dz = this.data.targetZ - this.data.originZ;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
}
