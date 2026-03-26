/**
 * @fileoverview MyTargetSelectedHandler - обработчик пакета MyTargetSelected (0xA1)
 * @module infrastructure/protocol/game/handlers
 */

import type { PacketContext, IPacketReader, IEventBus } from '../../../../application/ports';
import type { ICharacterRepository, IWorldRepository } from '../../../../domain/repositories';
import { BasePacketHandlerStrategy } from '../GamePacketProcessor';
import { MyTargetSelectedPacket } from '../packets/MyTargetSelectedPacket';
import { CharacterTargetChangedEvent } from '../../../../domain/events';
import { ObjectId } from '../../../../domain/value-objects';

/**
 * Стратегия обработки пакета MyTargetSelected
 * Обрабатывает выбор цели персонажем
 */
export class MyTargetSelectedHandler extends BasePacketHandlerStrategy<MyTargetSelectedPacket> {
    constructor(
        eventBus: IEventBus,
        private characterRepo: ICharacterRepository,
        private worldRepo: IWorldRepository
    ) {
        super(0xA1, eventBus);
    }

    protected canHandleInState(state: string): boolean {
        return state === 'IN_GAME';
    }

    handle(_context: PacketContext, reader: IPacketReader): void {
        const packet = new MyTargetSelectedPacket().decode(reader);
        const data = packet.getData();

        const character = this.characterRepo.get();
        if (!character) {
            return;
        }

        // Определяем тип цели и её имя
        let targetType: 'NPC' | 'PLAYER' | undefined;
        let targetName: string | undefined;
        let targetHp: { current: number; max: number } | undefined;

        // Проверяем NPC
        const npc = this.worldRepo.getNpc(data.targetId);
        if (npc) {
            targetType = 'NPC';
            targetName = npc.name;
            targetHp = { current: npc.currentHp, max: npc.maxHp };
        } else {
            // Считаем что это игрок или другая сущность
            targetType = 'PLAYER';
        }

        // Обновляем цель персонажа
        this.characterRepo.update((char) => {
            char.setTarget(data.targetId);
            return char;
        });

        // Публикуем событие изменения цели
        this.eventBus.publish(new CharacterTargetChangedEvent(
            {
                previousTargetId: character.targetId,
                newTargetId: data.targetId,
                targetType,
                targetName,
                targetHp,
            },
            ObjectId.of(character.id)
        ));
    }
}
