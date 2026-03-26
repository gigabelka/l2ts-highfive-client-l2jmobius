/**
 * @fileoverview ItemListHandler - обработчик пакета ItemList (0x1B)
 * @module infrastructure/protocol/game/handlers
 */

import type { PacketContext, IPacketReader, IEventBus } from '../../../../application/ports';
import type { IInventoryRepository, ICharacterRepository } from '../../../../domain/repositories';
import { ObjectId } from '../../../../domain/value-objects';
import { BasePacketHandlerStrategy } from '../GamePacketProcessor';
import { ItemListPacket } from '../packets/ItemListPacket';
import { InventoryItem } from '../../../../domain/entities';
import { InventoryItemAddedEvent, AdenaChangedEvent } from '../../../../domain/events';

/**
 * Стратегия обработки пакета ItemList
 * Обновляет полный инвентарь
 */
export class ItemListHandler extends BasePacketHandlerStrategy<ItemListPacket> {
    constructor(
        eventBus: IEventBus,
        private inventoryRepo: IInventoryRepository,
        private characterRepo: ICharacterRepository
    ) {
        super(0x1B, eventBus);
    }

    protected canHandleInState(state: string): boolean {
        return state === 'IN_GAME' || state === 'WAIT_USER_INFO';
    }

    handle(_context: PacketContext, reader: IPacketReader): void {
        const packet = new ItemListPacket().decode(reader);
        const data = packet.getData();

        const character = this.characterRepo.get();
        const charObjectId = character ? ObjectId.of(character.id) : ObjectId.of(0);

        // Обновляем адену
        this.inventoryRepo.updateAdena(data.adena);
        this.eventBus.publish(new AdenaChangedEvent(
            { oldAmount: 0, newAmount: data.adena, delta: data.adena },
            charObjectId
        ));

        // Добавляем предметы
        for (const itemData of data.items) {
            const item = InventoryItem.create({
                objectId: itemData.objectId,
                itemId: itemData.itemId,
                name: `Item_${itemData.itemId}`, // Name would be resolved from database
                count: itemData.count,
                type: this.getItemType(itemData.itemId),
                equipped: itemData.isEquipped,
                slot: itemData.slot,
                enchant: itemData.enchantLevel,
                mana: 0,
            });

            this.inventoryRepo.addOrUpdateItem(item);
            
            this.eventBus.publish(new InventoryItemAddedEvent(
                {
                    item: {
                        objectId: itemData.objectId,
                        itemId: itemData.itemId,
                        name: item.name,
                        count: itemData.count,
                        equipped: itemData.isEquipped,
                        enchant: itemData.enchantLevel,
                        slot: itemData.slot,
                    }
                },
                charObjectId
            ));
        }
    }

    private getItemType(itemId: number): 'weapon' | 'armor' | 'consumable' | 'material' | 'quest' | 'etc' {
        // Simple heuristic based on item ID ranges
        if (itemId >= 1 && itemId < 1000) return 'weapon';
        if (itemId >= 1000 && itemId < 10000) return 'armor';
        if (itemId >= 10000 && itemId < 20000) return 'consumable';
        if (itemId >= 20000 && itemId < 30000) return 'material';
        if (itemId >= 60000) return 'quest';
        return 'etc';
    }
}
