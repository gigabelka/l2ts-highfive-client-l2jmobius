/**
 * @fileoverview AttackPacket - DTO для пакета Attack (0x05)
 * Атака персонажа или NPC
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface HitData {
    targetId: number;
    damage: number;
    flags: number; // 0x10 = miss, 0x20 = crit, 0x40 = shld
}

export interface AttackData {
    attackerId: number;
    targetId: number;
    hits: HitData[];
}

/**
 * Пакет Attack (0x05)
 * Атака с возможностью нескольких ударов (для боссов/скиллов)
 */
export class AttackPacket implements IIncomingPacket {
    readonly opcode = 0x05;
    private data!: AttackData;

    decode(reader: IPacketReader): this {
        const attackerId = reader.readInt32LE();
        const targetId = reader.readInt32LE();
        
        // Skip some position data that might be present
        if (reader.remaining() > 20) {
            reader.skip(12); // Position data (x, y, z)
        }
        
        const hitCount = reader.readInt32LE();
        const hits: HitData[] = [];

        for (let i = 0; i < hitCount; i++) {
            const hitTargetId = reader.readInt32LE();
            const damage = reader.readInt32LE();
            const flags = reader.readInt32LE(); // Miss/Crit/Shield flags
            
            // Skip additional server info
            if (reader.remaining() >= 4) {
                reader.skip(4);
            }

            hits.push({
                targetId: hitTargetId,
                damage,
                flags,
            });
        }

        this.data = {
            attackerId,
            targetId,
            hits,
        };

        return this;
    }

    getData(): AttackData {
        return { ...this.data, hits: [...this.data.hits] };
    }

    isMiss(hitIndex: number = 0): boolean {
        const hit = this.data.hits[hitIndex];
        return hit ? (hit.flags & 0x10) !== 0 : false;
    }

    isCritical(hitIndex: number = 0): boolean {
        const hit = this.data.hits[hitIndex];
        return hit ? (hit.flags & 0x20) !== 0 : false;
    }

    isShielded(hitIndex: number = 0): boolean {
        const hit = this.data.hits[hitIndex];
        return hit ? (hit.flags & 0x40) !== 0 : false;
    }
}
