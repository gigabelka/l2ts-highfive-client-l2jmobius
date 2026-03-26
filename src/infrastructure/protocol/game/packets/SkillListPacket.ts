/**
 * @fileoverview SkillListPacket - DTO для пакета SkillList (0x58)
 * Список скиллов персонажа
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface SkillData {
    skillId: number;
    level: number;
    isPassive: boolean;
}

export interface SkillListData {
    skills: SkillData[];
}

/**
 * Пакет SkillList (0x58)
 * Отправляется при входе в мир и при изучении новых скиллов
 */
export class SkillListPacket implements IIncomingPacket {
    readonly opcode = 0x58;
    private data!: SkillListData;

    decode(reader: IPacketReader): this {
        const skillCount = reader.readUInt16LE();
        const skills: SkillData[] = [];

        for (let i = 0; i < skillCount; i++) {
            const isPassive = reader.readInt32LE() !== 0;
            const skillLevel = reader.readInt32LE();
            const skillId = reader.readInt32LE();
            
            // SkillList in Interlude (746) usually doesn't have isDisabled byte 
            // but some variants might. Given 470 bytes and 39 skills, 
            // 2 + 39 * 12 = 470. So no extra byte here.

            skills.push({
                skillId,
                level: skillLevel,
                isPassive,
            });
        }

        this.data = { skills };
        return this;
    }

    getData(): SkillListData {
        return { skills: [...this.data.skills] };
    }
}
