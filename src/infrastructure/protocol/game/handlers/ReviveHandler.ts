/**
 * @fileoverview ReviveHandler - обработчик пакета Revive (0x07)
 * @module infrastructure/protocol/game/handlers
 */

import type { PacketContext, IPacketReader, IEventBus } from '../../../../application/ports';
import type { ICharacterRepository, IWorldRepository } from '../../../../domain/repositories';
import { BasePacketHandlerStrategy } from '../GamePacketProcessor';
import { RevivePacket } from '../packets/RevivePacket';
import { CharacterStatsChangedEvent, NpcInfoUpdatedEvent } from '../../../../domain/events';
import { ObjectId } from '../../../../domain/value-objects';

/**
 * Стратегия обработки пакета Revive
 * Обрабатывает воскрешение сущностей
 */
export class ReviveHandler extends BasePacketHandlerStrategy<RevivePacket> {
    constructor(
        eventBus: IEventBus,
        private characterRepo: ICharacterRepository,
        private worldRepo: IWorldRepository
    ) {
        super(0x07, eventBus);
    }

    protected canHandleInState(state: string): boolean {
        return state === 'IN_GAME';
    }

    handle(_context: PacketContext, reader: IPacketReader): void {
        const packet = new RevivePacket().decode(reader);
        const data = packet.getData();

        const character = this.characterRepo.get();

        // Проверяем, не наш ли персонаж воскрес
        if (character && character.id === data.objectId) {
            this.characterRepo.update((char) => {
                char.revive();
                return char;
            });

            this.eventBus.publish(
                CharacterStatsChangedEvent.createRevived(ObjectId.of(character.id))
            );
            return;
        }

        // Проверяем NPC
        const npc = this.worldRepo.getNpc(data.objectId);
        if (npc) {
            this.worldRepo.updateNpc(data.objectId, (n) => {
                n.revive();
                return n;
            });

            this.eventBus.publish(new NpcInfoUpdatedEvent({
                objectId: data.objectId,
            }));
        }
    }
}
