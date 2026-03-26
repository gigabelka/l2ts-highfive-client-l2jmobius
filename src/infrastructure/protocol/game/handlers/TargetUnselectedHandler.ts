/**
 * @fileoverview TargetUnselectedHandler - обработчик пакета TargetUnselected (0xA6)
 * @module infrastructure/protocol/game/handlers
 */

import type { PacketContext, IPacketReader, IEventBus } from '../../../../application/ports';
import type { ICharacterRepository } from '../../../../domain/repositories';
import { BasePacketHandlerStrategy } from '../GamePacketProcessor';
import { TargetUnselectedPacket } from '../packets/TargetUnselectedPacket';
import { CharacterTargetChangedEvent } from '../../../../domain/events';
import { ObjectId } from '../../../../domain/value-objects';

/**
 * Стратегия обработки пакета TargetUnselected
 * Обрабатывает сброс выбора цели
 */
export class TargetUnselectedHandler extends BasePacketHandlerStrategy<TargetUnselectedPacket> {
    constructor(
        eventBus: IEventBus,
        private characterRepo: ICharacterRepository
    ) {
        super(0xA6, eventBus);
    }

    protected canHandleInState(state: string): boolean {
        return state === 'IN_GAME';
    }

    handle(_context: PacketContext, reader: IPacketReader): void {
        const packet = new TargetUnselectedPacket().decode(reader);
        // Пакет содержит targetId, но он не нужен для сброса своей цели
        void packet.getData();

        const character = this.characterRepo.get();
        if (!character) {
            return;
        }

        // Проверяем, что сброс цели относится к нашему персонажу
        // (в некоторых случаях targetId может быть objectId нашего персонажа)
        const previousTargetId = character.targetId;

        // Обновляем цель персонажа
        this.characterRepo.update((char) => {
            char.clearTarget();
            return char;
        });

        // Публикуем событие сброса цели
        this.eventBus.publish(new CharacterTargetChangedEvent(
            {
                previousTargetId,
                newTargetId: undefined,
            },
            ObjectId.of(character.id)
        ));
    }
}
