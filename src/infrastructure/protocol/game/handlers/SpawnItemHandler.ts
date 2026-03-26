/**
 * @fileoverview SpawnItemHandler - обработчик пакета SpawnItem (0x0B)
 * @module infrastructure/protocol/game/handlers
 */

import type { PacketContext, IPacketReader, IEventBus } from '../../../../application/ports';
import type { IWorldRepository } from '../../../../domain/repositories';
import { BasePacketHandlerStrategy } from '../GamePacketProcessor';
import { SpawnItemPacket } from '../packets/SpawnItemPacket';
import { WorldItem } from '../../../../domain/entities';

import { Position } from '../../../../domain/value-objects';

/**
 * Стратегия обработки пакета SpawnItem
 * Обрабатывает появление предметов в мире
 */
export class SpawnItemHandler extends BasePacketHandlerStrategy<SpawnItemPacket> {
    constructor(
        eventBus: IEventBus,
        private worldRepo: IWorldRepository
    ) {
        super(0x0B, eventBus);
    }

    protected canHandleInState(state: string): boolean {
        return state === 'IN_GAME';
    }

    handle(_context: PacketContext, reader: IPacketReader): void {
        const packet = new SpawnItemPacket().decode(reader);
        const data = packet.getData();

        // Создаем предмет в мире
        const { item, event } = WorldItem.spawn({
            objectId: data.objectId,
            itemId: data.itemId,
            name: `Item_${data.itemId}`,
            count: data.count,
            position: Position.at(data.x, data.y, data.z),
        });

        this.worldRepo.saveItem(item);
        this.eventBus.publish(event);
    }
}
