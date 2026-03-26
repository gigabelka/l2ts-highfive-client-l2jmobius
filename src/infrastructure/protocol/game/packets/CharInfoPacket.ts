/**
 * @fileoverview CharInfoPacket - DTO для пакета CharInfo (0x03)
 * Информация о других игроках
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface CharInfoData {
    objectId: number;
    name: string;
    race: number;
    sex: number;
    classId: number;
    level: number;
    x: number;
    y: number;
    z: number;
    heading: number;
    isRunning: boolean;
    isInCombat: boolean;
    isDead: boolean;
    title: string;
}

/**
 * Пакет CharInfo (0x03)
 * Информация о других игроках в мире
 */
export class CharInfoPacket implements IIncomingPacket {
    readonly opcode = 0x03;
    private data!: CharInfoData;

    decode(reader: IPacketReader): this {
        const x = reader.readInt32LE();
        const y = reader.readInt32LE();
        const z = reader.readInt32LE();
        const heading = reader.readInt32LE();
        const objectId = reader.readInt32LE();

        // Name
        const name = reader.readStringUTF16();

        // Race, sex, class
        const race = reader.readInt32LE();
        const sex = reader.readInt32LE();
        const classId = reader.readInt32LE();

        // Equipment (simplified - just skip for now)
        // Full implementation would parse paperdoll items
        for (let i = 0; i < 10; i++) {
            reader.readInt32LE(); // itemId
        }

        // Movement data
        const isRunning = reader.readUInt8() !== 0;
        const isInCombat = reader.readUInt8() !== 0;
        const isDead = reader.readUInt8() !== 0;

        // Title
        const title = reader.readStringUTF16();

        // Speeds (skip)
        reader.readInt32LE();
        reader.readInt32LE();
        reader.readInt32LE();
        reader.readInt32LE();
        reader.readInt32LE();
        reader.readInt32LE();
        reader.readFloatLE();
        reader.readFloatLE();
        reader.readFloatLE();
        reader.readFloatLE();

        // Level
        let level = 1;
        if (reader.remaining() >= 4) {
            level = reader.readInt32LE();
        }

        this.data = {
            objectId,
            name,
            race,
            sex,
            classId,
            level,
            x,
            y,
            z,
            heading,
            isRunning,
            isInCombat,
            isDead,
            title,
        };

        return this;
    }

    getData(): CharInfoData {
        return { ...this.data };
    }
}
