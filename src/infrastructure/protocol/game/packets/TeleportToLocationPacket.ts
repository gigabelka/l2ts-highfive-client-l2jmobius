/**
 * @fileoverview TeleportToLocationPacket - DTO для пакета TeleportToLocation (0x27)
 * Телепорт сущности на указанную позицию
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface TeleportToLocationData {
    objectId: number;
    x: number;
    y: number;
    z: number;
}

/**
 * Пакет TeleportToLocation (0x27)
 * Уведомление о телепорте сущности
 * 
 * L2J Mobius CT0 Interlude format:
 * - objectId: int32 (4 bytes)
 * - x: int32 (4 bytes)
 * - y: int32 (4 bytes)
 * - z: int32 (4 bytes)
 * 
 * Total: 16 bytes
 */
export class TeleportToLocationPacket implements IIncomingPacket {
    readonly opcode = 0x27;
    private data!: TeleportToLocationData;

    decode(reader: IPacketReader): this {
        const objectId = reader.readInt32LE();
        const x = reader.readInt32LE();
        const y = reader.readInt32LE();
        const z = reader.readInt32LE();

        this.data = {
            objectId,
            x,
            y,
            z,
        };

        return this;
    }

    getData(): TeleportToLocationData {
        return { ...this.data };
    }
}
