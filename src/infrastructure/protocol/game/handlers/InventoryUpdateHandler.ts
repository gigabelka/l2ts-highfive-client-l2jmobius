/**
 * @fileoverview InventoryUpdateHandler - обработчик пакета InventoryUpdate (0x19)
 * @module infrastructure/protocol/game/handlers
 */

import type { PacketContext, IPacketReader, IEventBus } from '../../../../application/ports';
import type { IInventoryRepository, ICharacterRepository } from '../../../../domain/repositories';
import { ObjectId } from '../../../../domain/value-objects';
import { BasePacketHandlerStrategy } from '../GamePacketProcessor';
import { InventoryUpdatePacket } from '../packets/InventoryUpdatePacket';
import { InventoryItem } from '../../../../domain/entities';
import { InventoryItemAddedEvent, InventoryItemRemovedEvent, InventoryItemUpdatedEvent, AdenaChangedEvent } from '../../../../domain/events';

/**
 * Стратегия обработки пакета InventoryUpdate
 * Обрабатывает частичное обновление инвентаря
 */
export class InventoryUpdateHandler extends BasePacketHandlerStrategy<InventoryUpdatePacket> {
    constructor(
        eventBus: IEventBus,
        private inventoryRepo: IInventoryRepository,
        private characterRepo: ICharacterRepository
    ) {
        super(0x19, eventBus);
    }

    protected canHandleInState(state: string): boolean {
        return state === 'IN_GAME';
    }

    handle(_context: PacketContext, reader: IPacketReader): void {
        const packet = new InventoryUpdatePacket().decode(reader);
        const data = packet.getData();

        const character = this.characterRepo.get();
        const charObjectId = character ? ObjectId.of(character.id) : ObjectId.of(0);

        for (const change of data.changes) {
            switch (change.changeType) {
                case 'ADD':
                    this.handleAdd(change, charObjectId);
                    break;
                case 'UPDATE':
                    this.handleUpdate(change, charObjectId);
                    break;
                case 'REMOVE':
                    this.handleRemove(change, charObjectId);
                    break;
            }
        }
    }

    private handleAdd(change: import('../packets/InventoryUpdatePacket').InventoryChange, charObjectId: ObjectId): void {
        const item = InventoryItem.create({
            objectId: change.objectId,
            itemId: change.itemId,
            name: `Item_${change.itemId}`,
            count: change.count,
            type: 'etc',
            equipped: change.isEquipped,
            slot: change.slot,
            enchant: change.enchantLevel,
            mana: 0,
        });

        this.inventoryRepo.addOrUpdateItem(item);

        // Check if it's adena (itemId 57)
        if (change.itemId === 57) {
            const currentAdena = this.inventoryRepo.getAdena();
            this.inventoryRepo.updateAdena(currentAdena + change.count);
            this.eventBus.publish(new AdenaChangedEvent(
                { oldAmount: currentAdena, newAmount: currentAdena + change.count, delta: change.count },
                charObjectId
            ));
        }

        this.eventBus.publish(new InventoryItemAddedEvent(
            {
                item: {
                    objectId: change.objectId,
                    itemId: change.itemId,
                    name: item.name,
                    count: change.count,
                    equipped: change.isEquipped,
                    enchant: change.enchantLevel,
                    slot: change.slot,
                }
            },
            charObjectId
        ));
    }

    private handleUpdate(change: import('../packets/InventoryUpdatePacket').InventoryChange, charObjectId: ObjectId): void {
        const existingItem = this.inventoryRepo.getItem(change.objectId);
        const oldCount = existingItem?.count || 0;

        const item = InventoryItem.create({
            objectId: change.objectId,
            itemId: change.itemId,
            name: existingItem?.name || `Item_${change.itemId}`,
            count: change.count,
            type: existingItem?.type || 'etc',
            equipped: change.isEquipped,
            slot: change.slot,
            enchant: change.enchantLevel,
            mana: 0,
        });

        this.inventoryRepo.addOrUpdateItem(item);

        this.eventBus.publish(new InventoryItemUpdatedEvent(
            {
                item: {
                    objectId: change.objectId,
                    itemId: change.itemId,
                    name: item.name,
                    count: change.count,
                    equipped: change.isEquipped,
                    enchant: change.enchantLevel,
                    slot: change.slot,
                },
                previousCount: oldCount,
            },
            charObjectId
        ));
    }

    private handleRemove(change: import('../packets/InventoryUpdatePacket').InventoryChange, charObjectId: ObjectId): void {
        const existingItem = this.inventoryRepo.removeItem(change.objectId);
        
        if (existingItem.isOk()) {
            const item = existingItem.getOrThrow();
            this.eventBus.publish(new InventoryItemRemovedEvent(
                {
                    objectId: change.objectId,
                    itemId: change.itemId,
                    name: item.name,
                },
                charObjectId
            ));
        }
    }
}
