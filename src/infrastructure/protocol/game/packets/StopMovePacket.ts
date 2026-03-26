/**
 * @fileoverview StopMovePacket - DTO для пакета StopMove (0x59)
 * Остановка движения сущности
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface StopMoveData {
    objectId: number;
    x: number;
    y: number;
    z: number;
    heading: number;
}

/**
 * Пакет StopMove (0x59)
 * Уведомление об остановке движения сущности
 * 
 * L2J Mobius CT0 Interlude format:
 * - objectId: int32 (4 bytes)
 * - x: int32 (4 bytes)
 * - y: int32 (4 bytes)
 * - z: int32 (4 bytes)
 * - heading: int32 (4 bytes)
 * 
 * Total: 20 bytes
 */
export class StopMovePacket implements IIncomingPacket {
    readonly opcode = 0x59;
    private data!: StopMoveData;

    decode(reader: IPacketReader): this {
        const objectId = reader.readInt32LE();
        const x = reader.readInt32LE();
        const y = reader.readInt32LE();
        const z = reader.readInt32LE();
        const heading = reader.readInt32LE();

        this.data = {
            objectId,
            x,
            y,
            z,
            heading,
        };

        return this;
    }

    getData(): StopMoveData {
        return { ...this.data };
    }
}
