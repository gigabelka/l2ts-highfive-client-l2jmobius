/**
 * @fileoverview UserInfoPacket - DTO для пакета UserInfo (0x04)
 * Только декодирование, без side effects (SRP)
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader } from '../../../../application/ports';
import type { IIncomingPacket } from '../../../../application/ports';

/**
 * Данные пакета UserInfo
 */
export interface UserInfoData {
    objectId: number;
    name: string;
    title: string;
    race: number;
    sex: number;
    classId: number;
    level: number;
    exp: number;
    str: number;
    dex: number;
    con: number;
    int: number;
    wit: number;
    men: number;
    maxHp: number;
    currentHp: number;
    maxMp: number;
    currentMp: number;
    maxCp: number;
    currentCp: number;
    sp: number;
    currentLoad: number;
    maxLoad: number;
    x: number;
    y: number;
    z: number;
    vehicleId: number;
}

/**
 * Пакет UserInfo (0x04)
 * Содержит полную информацию о персонаже при входе в мир
 */
export class UserInfoPacket implements IIncomingPacket {
    readonly opcode = 0x04;
    private data!: UserInfoData;

    decode(reader: IPacketReader): this {
        const x = reader.readInt32LE();
        const y = reader.readInt32LE();
        const z = reader.readInt32LE();
        const vehicleId = reader.readInt32LE();
        const objectId = reader.readInt32LE();
        const name = reader.readStringUTF16();
        const race = reader.readInt32LE();
        const sex = reader.readInt32LE();
        const classId = reader.readInt32LE();
        const level = reader.readInt32LE();
        const exp = Number(reader.readInt64LE());
        
        // Base stats
        const str = reader.readInt32LE();
        const dex = reader.readInt32LE();
        const con = reader.readInt32LE();
        const int = reader.readInt32LE();
        const wit = reader.readInt32LE();
        const men = reader.readInt32LE();

        // Vitals
        const maxHp = reader.readInt32LE();
        const currentHp = reader.readInt32LE();
        const maxMp = reader.readInt32LE();
        const currentMp = reader.readInt32LE();

        // In Interlude, CP comes after MP
        // Note: Some servers might have different structure, adjust as needed
        let maxCp = 0;
        let currentCp = 0;
        
        // Try to read CP if there's remaining data
        if (reader.remaining() >= 8) {
            maxCp = reader.readInt32LE();
            currentCp = reader.readInt32LE();
        }

        const sp = reader.readInt32LE();
        const currentLoad = reader.readInt32LE();
        const maxLoad = reader.readInt32LE();

        this.data = {
            objectId,
            name,
            title: '', // Title comes later in packet structure
            race,
            sex,
            classId,
            level,
            exp,
            str,
            dex,
            con,
            int,
            wit,
            men,
            maxHp,
            currentHp,
            maxMp,
            currentMp,
            maxCp,
            currentCp,
            sp,
            currentLoad,
            maxLoad,
            x,
            y,
            z,
            vehicleId,
        };

        return this;
    }

    getData(): UserInfoData {
        return { ...this.data };
    }
}
