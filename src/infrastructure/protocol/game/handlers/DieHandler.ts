/**
 * @fileoverview DieHandler - обработчик пакета Die (0x06)
 * @module infrastructure/protocol/game/handlers
 */

import type { PacketContext, IPacketReader, IEventBus } from '../../../../application/ports';
import type { ICharacterRepository, IWorldRepository } from '../../../../domain/repositories';
import { BasePacketHandlerStrategy } from '../GamePacketProcessor';
import { DiePacket } from '../packets/DiePacket';
import { CharacterStatsChangedEvent, TargetDiedEvent } from '../../../../domain/events';
import { ObjectId } from '../../../../domain/value-objects';

/**
 * Стратегия обработки пакета Die
 * Обрабатывает смерть сущностей
 */
export class DieHandler extends BasePacketHandlerStrategy<DiePacket> {
    constructor(
        eventBus: IEventBus,
        private characterRepo: ICharacterRepository,
        private worldRepo: IWorldRepository
    ) {
        super(0x06, eventBus);
    }

    protected canHandleInState(state: string): boolean {
        return state === 'IN_GAME';
    }

    handle(_context: PacketContext, reader: IPacketReader): void {
        const packet = new DiePacket().decode(reader);
        const data = packet.getData();

        const character = this.characterRepo.get();

        // Проверяем, не наш ли персонаж умер
        if (character && character.id === data.objectId) {
            this.characterRepo.update((char) => {
                char.die();
                return char;
            });

            this.eventBus.publish(
                CharacterStatsChangedEvent.createDied(ObjectId.of(character.id))
            );
            return;
        }

        // Проверяем NPC
        const npc = this.worldRepo.getNpc(data.objectId);
        if (npc) {
            this.worldRepo.updateNpc(data.objectId, (n) => {
                n.die();
                return n;
            });

            this.eventBus.publish(new TargetDiedEvent({
                targetId: data.objectId,
                targetName: npc.name,
            }));
        }
    }
}
