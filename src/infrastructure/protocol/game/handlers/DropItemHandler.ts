/**
 * @fileoverview DropItemHandler - обработчик пакета DropItem (0x0C)
 * @module infrastructure/protocol/game/handlers
 */

import type { PacketContext, IPacketReader, IEventBus } from '../../../../application/ports';
import type { IWorldRepository } from '../../../../domain/repositories';
import { BasePacketHandlerStrategy } from '../GamePacketProcessor';
import { DropItemPacket } from '../packets/DropItemPacket';
import { WorldItem } from '../../../../domain/entities';

import { Position } from '../../../../domain/value-objects';

/**
 * Стратегия обработки пакета DropItem
 * Обрабатывает выпадение предметов из инвентаря/мобов
 */
export class DropItemHandler extends BasePacketHandlerStrategy<DropItemPacket> {
    constructor(
        eventBus: IEventBus,
        private worldRepo: IWorldRepository
    ) {
        super(0x0C, eventBus);
    }

    protected canHandleInState(state: string): boolean {
        return state === 'IN_GAME';
    }

    handle(_context: PacketContext, reader: IPacketReader): void {
        const packet = new DropItemPacket().decode(reader);
        const data = packet.getData();

        // Создаем выпавший предмет
        const { item, event } = WorldItem.spawn({
            objectId: data.objectId,
            itemId: data.itemId,
            name: `Item_${data.itemId}`,
            count: data.count,
            position: Position.at(data.x, data.y, data.z),
            droppedById: data.droppedById,
        });

        this.worldRepo.saveItem(item);
        this.eventBus.publish(event);
    }
}
