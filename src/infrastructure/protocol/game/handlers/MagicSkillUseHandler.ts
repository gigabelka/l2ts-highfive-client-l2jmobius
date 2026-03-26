/**
 * @fileoverview MagicSkillUseHandler - обработчик пакета MagicSkillUse (0x76)
 * @module infrastructure/protocol/game/handlers
 */

import type { PacketContext, IPacketReader, IEventBus } from '../../../../application/ports';
import type { ICharacterRepository, IWorldRepository } from '../../../../domain/repositories';
import { BasePacketHandlerStrategy } from '../GamePacketProcessor';
import { MagicSkillUsePacket } from '../packets/MagicSkillUsePacket';
import { SkillUseEvent, NpcInfoUpdatedEvent } from '../../../../domain/events';
import { Position } from '../../../../domain/value-objects';

/**
 * Стратегия обработки пакета MagicSkillUse
 * Обрабатывает использование скиллов
 */
export class MagicSkillUseHandler extends BasePacketHandlerStrategy<MagicSkillUsePacket> {
    constructor(
        eventBus: IEventBus,
        private characterRepo: ICharacterRepository,
        private worldRepo: IWorldRepository
    ) {
        super(0x76, eventBus);
    }

    protected canHandleInState(state: string): boolean {
        return state === 'IN_GAME';
    }

    handle(_context: PacketContext, reader: IPacketReader): void {
        const packet = new MagicSkillUsePacket().decode(reader);
        const data = packet.getData();

        const character = this.characterRepo.get();

        // Определяем имя кастера
        let casterName = 'Unknown';
        if (character && character.id === data.activeCharId) {
            casterName = character.name;
        } else {
            const npc = this.worldRepo.getNpc(data.activeCharId);
            if (npc) {
                casterName = npc.name;
            }
        }

        // Определяем имя цели
        let targetName: string | undefined;
        if (character && character.id === data.targetId) {
            targetName = character.name;
        } else {
            const targetNpc = this.worldRepo.getNpc(data.targetId);
            if (targetNpc) {
                targetName = targetNpc.name;
            }
        }

        // Публикуем событие использования скила
        this.eventBus.publish(new SkillUseEvent({
            casterId: data.activeCharId,
            casterName,
            targetId: data.targetId,
            targetName,
            skillId: data.skillId,
            skillLevel: data.skillLevel,
            castTime: data.hitTime,
        }));

        // Если кастер - NPC, обновляем его позицию
        const casterNpc = this.worldRepo.getNpc(data.activeCharId);
        if (casterNpc) {
            this.worldRepo.updateNpc(data.activeCharId, (npc) => {
                npc.updatePosition(Position.at(data.x, data.y, data.z));
                return npc;
            });

            this.eventBus.publish(new NpcInfoUpdatedEvent({
                objectId: data.activeCharId,
                position: Position.at(data.x, data.y, data.z),
            }));
        }
    }
}
