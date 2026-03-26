/**
 * @fileoverview NpcInfoPacket - DTO для пакета NpcInfo (0x16)
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface NpcInfoData {
    objectId: number;
    npcId: number;
    attackable: boolean;
    x: number;
    y: number;
    z: number;
    heading: number;
    name: string;
    title: string;
    level: number;
    isDead: boolean;
    currentHp: number;
    maxHp: number;
}

/**
 * Пакет NpcInfo (0x16) для L2J Mobius CT_0_Interlude
 * 
 * Исправленная структура (наблюдаемая):
 * - objectId (int32)
 * - npcIdRaw (int32) - attackable flag in upper bit
 * - skip (int32) - unknown/misaligned value (isDead?)
 * - x (int32)
 * - y (int32)  
 * - z (int32)
 * - heading (int32)
 * - ... rest of packet
 */
export class NpcInfoPacket implements IIncomingPacket {
    readonly opcode = 0x16;
    private data!: NpcInfoData;

    decode(reader: IPacketReader): this {
        const objectId = reader.readInt32LE();
        
        // npcId + attackable flag in upper bits (may be different for Interlude)
        const npcIdRaw = reader.readInt32LE();
        // For Interlude: assume all NPCs are attackable by default
        // The attackable flag in upper bit doesn't seem to work correctly
        const npcId = npcIdRaw & 0x7FFFFFFF;
        const attackable = true; // Default to attackable for all NPCs

        // Skip 1 int32 (misaligned/mystery field)
        reader.readInt32LE();

        // Coordinates (correctly aligned)
        const x = reader.readInt32LE();
        const y = reader.readInt32LE();
        const z = reader.readInt32LE();
        const heading = reader.readInt32LE();

        // Skip collision radius/height (2x int32)
        reader.readInt32LE();
        reader.readInt32LE();

        // Skip movement speeds (6x int32)
        reader.readInt32LE();
        reader.readInt32LE();
        reader.readInt32LE();
        reader.readInt32LE();
        reader.readInt32LE();
        reader.readInt32LE();

        // Skip float multipliers (4x float)
        reader.readFloatLE();
        reader.readFloatLE();
        reader.readFloatLE();
        reader.readFloatLE();

        // Skip isDead flag byte (for Interlude - position may vary)
        // Note: Real death state comes from StatusUpdate packet
        reader.readUInt8();
        const isDead = false;

        // Name and title (UTF-16LE strings)
        const name = reader.readStringUTF16();
        const title = reader.readStringUTF16();

        // Level не присутствует в пакете NpcInfo для Interlude
        // Устанавливаем значение по умолчанию
        const level = 1;

        // HP data not present in Interlude NpcInfo
        const currentHp = isDead ? 0 : 100;
        const maxHp = 100;
        
        this.data = {
            objectId,
            npcId,
            attackable,
            x,
            y,
            z,
            heading,
            name,
            title,
            level,
            isDead,
            currentHp,
            maxHp,
        };

        return this;
    }

    getData(): NpcInfoData {
        return { ...this.data };
    }
}
