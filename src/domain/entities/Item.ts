/**
 * @fileoverview Item - сущность предмета/дропа
 * @module domain/entities
 */

import { ObjectId, ItemTemplateId, Position } from '../value-objects';
import { ItemDroppedEvent, ItemPickedUpEvent } from '../events';
import type { DomainEvent } from '../events';

export type ItemType = 'weapon' | 'armor' | 'consumable' | 'material' | 'quest' | 'etc';
export type ItemGrade = 'No' | 'D' | 'C' | 'B' | 'A' | 'S';

export interface InventoryItemData {
    objectId: number;
    itemId: number;
    name: string;
    count: number;
    type: ItemType;
    equipped: boolean;
    slot: number;
    enchant: number;
    mana: number;
    grade?: ItemGrade;
}

export interface WorldItemData {
    objectId: number;
    itemId: number;
    name: string;
    count: number;
    position: Position;
    droppedById?: number;
}

/**
 * Сущность предмета в инвентаре
 */
export class InventoryItem {
    constructor(
        readonly objectId: ObjectId,
        readonly templateId: ItemTemplateId,
        private data: InventoryItemData
    ) {}

    get id(): number {
        return this.objectId.value;
    }

    get itemId(): number {
        return this.templateId.value;
    }

    get name(): string {
        return this.data.name;
    }

    get count(): number {
        return this.data.count;
    }

    get type(): ItemType {
        return this.data.type;
    }

    get equipped(): boolean {
        return this.data.equipped;
    }

    get slot(): number {
        return this.data.slot;
    }

    get enchant(): number {
        return this.data.enchant;
    }

    get grade(): ItemGrade | undefined {
        return this.data.grade;
    }

    equip(): InventoryItem {
        return new InventoryItem(
            this.objectId,
            this.templateId,
            { ...this.data, equipped: true }
        );
    }

    unequip(): InventoryItem {
        return new InventoryItem(
            this.objectId,
            this.templateId,
            { ...this.data, equipped: false }
        );
    }

    updateCount(newCount: number): InventoryItem {
        return new InventoryItem(
            this.objectId,
            this.templateId,
            { ...this.data, count: newCount }
        );
    }

    static create(data: InventoryItemData): InventoryItem {
        return new InventoryItem(
            ObjectId.of(data.objectId),
            ItemTemplateId.create(data.itemId).getOrThrow(),
            data
        );
    }

    toJSON(): InventoryItemData {
        return { ...this.data };
    }
}

/**
 * Сущность дропа в мире
 */
export class WorldItem {
    private uncommittedEvents: DomainEvent[] = [];

    constructor(
        readonly objectId: ObjectId,
        readonly templateId: ItemTemplateId,
        private data: WorldItemData
    ) {}

    get id(): number {
        return this.objectId.value;
    }

    get itemId(): number {
        return this.templateId.value;
    }

    get name(): string {
        return this.data.name;
    }

    get count(): number {
        return this.data.count;
    }

    get position(): Position {
        return this.data.position;
    }

    get droppedById(): number | undefined {
        return this.data.droppedById;
    }

    markAsPickedUp(byId: number, byName?: string): void {
        this.uncommittedEvents.push(
            new ItemPickedUpEvent({ objectId: this.id, pickedById: byId, pickedByName: byName })
        );
    }

    getUncommittedEvents(): DomainEvent[] {
        return [...this.uncommittedEvents];
    }

    clearUncommittedEvents(): void {
        this.uncommittedEvents = [];
    }

    static spawn(data: WorldItemData): { item: WorldItem; event: ItemDroppedEvent } {
        const objectId = ObjectId.of(data.objectId);
        const templateId = ItemTemplateId.create(data.itemId).getOrThrow();
        const item = new WorldItem(objectId, templateId, data);

        const event = new ItemDroppedEvent({
            objectId: data.objectId,
            itemId: data.itemId,
            name: data.name,
            count: data.count,
            position: data.position,
            droppedById: data.droppedById,
        });

        return { item, event };
    }

    static create(data: WorldItemData): WorldItem {
        return WorldItem.spawn(data).item;
    }

    toJSON(): WorldItemData {
        return { ...this.data };
    }
}


