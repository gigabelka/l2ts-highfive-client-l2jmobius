/**
 * @fileoverview AbnormalStatusUpdateHandler - обработчик пакета AbnormalStatusUpdate (0x39)
 * @module infrastructure/protocol/game/handlers
 */

import type { PacketContext, IPacketReader, IEventBus } from '../../../../application/ports';
import type { ICharacterRepository } from '../../../../domain/repositories';
import { BasePacketHandlerStrategy } from '../GamePacketProcessor';
import { AbnormalStatusUpdatePacket } from '../packets/AbnormalStatusUpdatePacket';
import { CharacterSkillsUpdatedEvent } from '../../../../domain/events';
import { ObjectId } from '../../../../domain/value-objects';

/**
 * Стратегия обработки пакета AbnormalStatusUpdate
 * Обновляет список активных эффектов (баффы/дебаффы)
 */
export class AbnormalStatusUpdateHandler extends BasePacketHandlerStrategy<AbnormalStatusUpdatePacket> {
    constructor(
        eventBus: IEventBus,
        private characterRepo: ICharacterRepository
    ) {
        super(0x39, eventBus);
    }

    protected canHandleInState(state: string): boolean {
        return state === 'IN_GAME';
    }

    handle(_context: PacketContext, reader: IPacketReader): void {
        const packet = new AbnormalStatusUpdatePacket().decode(reader);
        const data = packet.getData();

        const character = this.characterRepo.get();
        if (!character) {
            return;
        }

        // Обновляем эффекты персонажа
        this.characterRepo.update((char) => {
            char.updateEffects(data.effects.map(e => ({
                skillId: e.skillId,
                duration: e.duration,
            })));
            return char;
        });

        // Публикуем событие обновления эффектов
        this.eventBus.publish(new CharacterSkillsUpdatedEvent(
            {
                skills: character.skills.map(s => ({
                    id: s.id,
                    level: s.level,
                    name: s.name,
                    isPassive: s.isPassive,
                })),
                activeEffects: data.effects.map(e => ({
                    skillId: e.skillId,
                    remainingTime: e.duration,
                })),
            },
            ObjectId.of(character.id)
        ));
    }
}
