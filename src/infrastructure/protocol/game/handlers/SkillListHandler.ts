/**
 * @fileoverview SkillListHandler - обработчик пакета SkillList (0x58)
 * @module infrastructure/protocol/game/handlers
 */

import type { PacketContext, IPacketReader, IEventBus } from '../../../../application/ports';
import type { ICharacterRepository } from '../../../../domain/repositories';
import { ObjectId } from '../../../../domain/value-objects';
import { BasePacketHandlerStrategy } from '../GamePacketProcessor';
import { SkillListPacket } from '../packets/SkillListPacket';
import { CharacterSkillsUpdatedEvent, type SkillInfo } from '../../../../domain/events';

/**
 * Стратегия обработки пакета SkillList
 * Обновляет список скиллов персонажа
 */
export class SkillListHandler extends BasePacketHandlerStrategy<SkillListPacket> {
    constructor(
        eventBus: IEventBus,
        private characterRepo: ICharacterRepository
    ) {
        super(0x58, eventBus);
    }

    protected canHandleInState(state: string): boolean {
        return state === 'IN_GAME' || state === 'WAIT_USER_INFO';
    }

    handle(_context: PacketContext, reader: IPacketReader): void {
        const packet = new SkillListPacket().decode(reader);
        const data = packet.getData();

        const character = this.characterRepo.get();
        const charObjectId = character ? ObjectId.of(character.id) : ObjectId.of(0);

        // Обновляем скиллы в репозитории
        this.characterRepo.update((char) => {
            const skills: SkillInfo[] = data.skills.map(s => ({
                id: s.skillId,
                level: s.level,
                isPassive: s.isPassive,
            }));
            
            char.updateSkills(skills);
            return char;
        });

        // Публикуем событие
        const skills = data.skills;
        const activeCount = skills.filter(s => !s.isPassive).length;
        const passiveCount = skills.filter(s => s.isPassive).length;

        this.eventBus.publish(new CharacterSkillsUpdatedEvent(
            {
                skills: data.skills.map(s => ({
                    id: s.skillId,
                    level: s.level,
                    isPassive: s.isPassive,
                })),
                totalCount: skills.length,
                activeCount,
                passiveCount,
            },
            charObjectId
        ));
    }
}
