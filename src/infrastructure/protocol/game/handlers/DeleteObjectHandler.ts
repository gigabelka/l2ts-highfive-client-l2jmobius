/**
 * @fileoverview DeleteObjectHandler - обработчик пакета DeleteObject (0x08)
 * @module infrastructure/protocol/game/handlers
 */

import type { PacketContext, IPacketReader, IEventBus } from '../../../../application/ports';
import type { ICharacterRepository, IWorldRepository } from '../../../../domain/repositories';
import { BasePacketHandlerStrategy } from '../GamePacketProcessor';
import { DeleteObjectPacket } from '../packets/DeleteObjectPacket';
import { NpcDespawnedEvent, PlayerDespawnedEvent, ItemPickedUpEvent } from '../../../../domain/events';

/**
 * Стратегия обработки пакета DeleteObject
 * Удаляет объект из мира
 */
export class DeleteObjectHandler extends BasePacketHandlerStrategy<DeleteObjectPacket> {
    constructor(
        eventBus: IEventBus,
        private characterRepo: ICharacterRepository,
        private worldRepo: IWorldRepository
    ) {
        super(0x08, eventBus);
    }

    protected canHandleInState(state: string): boolean {
        return state === 'IN_GAME';
    }

    handle(_context: PacketContext, reader: IPacketReader): void {
        const packet = new DeleteObjectPacket().decode(reader);
        const data = packet.getData();

        const character = this.characterRepo.get();

        // Проверяем, не наш ли это персонаж
        if (character && character.id === data.objectId) {
            // Игрок исчез (телепорт, выход из игры) - не удаляем из репозитория
            return;
        }

        // Проверяем NPC
        const npc = this.worldRepo.getNpc(data.objectId);
        if (npc) {
            this.worldRepo.removeNpc(data.objectId);
            this.eventBus.publish(new NpcDespawnedEvent({
                objectId: data.objectId,
                reason: 'despawned',
            }));
            return;
        }

        // Проверяем предмет
        const item = this.worldRepo.getItem(data.objectId);
        if (item) {
            this.worldRepo.removeItem(data.objectId);
            this.eventBus.publish(new ItemPickedUpEvent({
                objectId: data.objectId,
                pickedById: 0, // Неизвестно кто подобрал
            }));
            return;
        }

        // Возможно это другой игрок
        this.eventBus.publish(new PlayerDespawnedEvent({
            objectId: data.objectId,
        }));
    }
}
