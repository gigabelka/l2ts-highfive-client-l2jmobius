/**
 * @fileoverview ChangeWaitTypePacket - DTO для пакета ChangeWaitType (0x2F)
 * Изменение состояния сидения/стояния сущности
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface ChangeWaitTypeData {
    objectId: number;
    waitType: number; // 0 = standing, 1 = sitting
    x: number;
    y: number;
    z: number;
}

/**
 * Пакет ChangeWaitType (0x2F)
 * Уведомление об изменении состояния сидения/стояния
 * 
 * L2J Mobius CT0 Interlude format:
 * - objectId: int32 (4 bytes)
 * - waitType: int32 (4 bytes) - 0 = standing, 1 = sitting
 * - x: int32 (4 bytes) - координата X
 * - y: int32 (4 bytes) - координата Y
 * - z: int32 (4 bytes) - координата Z
 * 
 * Total: 20 bytes
 */
export class ChangeWaitTypePacket implements IIncomingPacket {
    readonly opcode = 0x2F;
    private data!: ChangeWaitTypeData;

    decode(reader: IPacketReader): this {
        const objectId = reader.readInt32LE();
        const waitType = reader.readInt32LE();
        const x = reader.readInt32LE();
        const y = reader.readInt32LE();
        const z = reader.readInt32LE();

        this.data = {
            objectId,
            waitType,
            x,
            y,
            z,
        };

        return this;
    }

    getData(): ChangeWaitTypeData {
        return { ...this.data };
    }

    /**
     * Проверяет, сидит ли сущность
     */
    isSitting(): boolean {
        return this.data.waitType === 1;
    }

    /**
     * Проверяет, стоит ли сущность
     */
    isStanding(): boolean {
        return this.data.waitType === 0;
    }
}
