/**
 * @fileoverview Character Events - события, связанные с персонажем
 * @module domain/events
 */

import { BaseDomainEvent } from './DomainEvent';
import type { Position } from '../value-objects';
import { ObjectId } from '../value-objects';

// =============================================================================
// Character Entered Game
// =============================================================================

export interface CharacterEnteredGamePayload {
    objectId: number;
    name: string;
    level: number;
    classId: number;
    raceId: number;
    sex: number;
    position: Position;
}

export class CharacterEnteredGameEvent extends BaseDomainEvent<CharacterEnteredGamePayload> {
    readonly type = 'character.entered_game';

    constructor(payload: CharacterEnteredGamePayload) {
        super(payload, ObjectId.of(payload.objectId));
    }
}

// =============================================================================
// Character Stats Changed
// =============================================================================

export interface CharacterStatsChangedPayload {
    hp?: {
        current: number;
        max: number;
        delta: number;
    };
    mp?: {
        current: number;
        max: number;
        delta: number;
    };
    cp?: {
        current: number;
        max: number;
        delta: number;
    };
}

export class CharacterStatsChangedEvent extends BaseDomainEvent<CharacterStatsChangedPayload> {
    readonly type = 'character.stats_changed';

    constructor(payload: CharacterStatsChangedPayload, objectId: ObjectId) {
        super(payload, objectId);
    }

    static createHpChanged(current: number, max: number, previous: number, objectId: ObjectId): CharacterStatsChangedEvent {
        return new CharacterStatsChangedEvent({
            hp: { current, max, delta: current - previous }
        }, objectId);
    }

    static createMpChanged(current: number, max: number, previous: number, objectId: ObjectId): CharacterStatsChangedEvent {
        return new CharacterStatsChangedEvent({
            mp: { current, max, delta: current - previous }
        }, objectId);
    }

    static createCpChanged(current: number, max: number, previous: number, objectId: ObjectId): CharacterStatsChangedEvent {
        return new CharacterStatsChangedEvent({
            cp: { current, max, delta: current - previous }
        }, objectId);
    }

    static createDied(objectId: ObjectId): CharacterStatsChangedEvent {
        return new CharacterStatsChangedEvent({
            hp: { current: 0, max: 0, delta: 0 }
        }, objectId);
    }

    static createRevived(objectId: ObjectId): CharacterStatsChangedEvent {
        return new CharacterStatsChangedEvent({
            hp: { current: 1, max: 1, delta: 0 } // Будет обновлено через StatusUpdate
        }, objectId);
    }
}

// =============================================================================
// Character Level Up
// =============================================================================

export interface CharacterLevelUpPayload {
    oldLevel: number;
    newLevel: number;
    exp: number;
    sp: number;
}

export class CharacterLevelUpEvent extends BaseDomainEvent<CharacterLevelUpPayload> {
    readonly type = 'character.level_up';

    constructor(payload: CharacterLevelUpPayload, objectId: ObjectId) {
        super(payload, objectId);
    }
}

// =============================================================================
// Character Position Changed
// =============================================================================

export interface CharacterPositionChangedPayload {
    previousPosition: Position;
    newPosition: Position;
    speed: number;
    isRunning: boolean;
}

export class CharacterPositionChangedEvent extends BaseDomainEvent<CharacterPositionChangedPayload> {
    readonly type = 'character.position_changed';

    constructor(payload: CharacterPositionChangedPayload, objectId: ObjectId) {
        super(payload, objectId);
    }
}

// =============================================================================
// Character Target Changed
// =============================================================================

export interface CharacterTargetChangedPayload {
    previousTargetId?: number;
    newTargetId?: number;
    targetName?: string;
    targetType?: 'NPC' | 'PLAYER';
    targetHp?: { current: number; max: number };
}

export class CharacterTargetChangedEvent extends BaseDomainEvent<CharacterTargetChangedPayload> {
    readonly type = 'character.target_changed';

    constructor(payload: CharacterTargetChangedPayload, objectId: ObjectId) {
        super(payload, objectId);
    }
}

// =============================================================================
// Character Skills Updated
// =============================================================================

export interface SkillInfo {
    id: number;
    level: number;
    name?: string;
    isPassive?: boolean;
}

export interface CharacterSkillsUpdatedPayload {
    skills: SkillInfo[];
    totalCount?: number;
    activeCount?: number;
    passiveCount?: number;
    activeEffects?: ActiveEffectInfo[];
}

export interface ActiveEffectInfo {
    skillId: number;
    remainingTime: number;
}

export class CharacterSkillsUpdatedEvent extends BaseDomainEvent<CharacterSkillsUpdatedPayload> {
    readonly type = 'character.skills_updated';

    constructor(payload: CharacterSkillsUpdatedPayload, objectId: ObjectId) {
        super(payload, objectId);
    }
}

// =============================================================================
// Character Inventory Events
// =============================================================================

export interface InventoryItemData {
    objectId: number;
    itemId: number;
    name: string;
    count: number;
    equipped: boolean;
    slot: number;
    enchant: number;
}

export interface InventoryItemAddedPayload {
    item: InventoryItemData;
}

export class InventoryItemAddedEvent extends BaseDomainEvent<InventoryItemAddedPayload> {
    readonly type = 'inventory.item_added';

    constructor(payload: InventoryItemAddedPayload, objectId: ObjectId) {
        super(payload, objectId);
    }
}

export interface InventoryItemRemovedPayload {
    objectId: number;
    itemId: number;
    name: string;
}

export class InventoryItemRemovedEvent extends BaseDomainEvent<InventoryItemRemovedPayload> {
    readonly type = 'inventory.item_removed';

    constructor(payload: InventoryItemRemovedPayload, characterId: ObjectId) {
        super(payload, characterId);
    }
}

export interface InventoryItemUpdatedPayload {
    item: InventoryItemData;
    previousCount: number;
}

export class InventoryItemUpdatedEvent extends BaseDomainEvent<InventoryItemUpdatedPayload> {
    readonly type = 'inventory.item_updated';

    constructor(payload: InventoryItemUpdatedPayload, objectId: ObjectId) {
        super(payload, objectId);
    }
}

export interface AdenaChangedPayload {
    oldAmount: number;
    newAmount: number;
    delta: number;
}

export class AdenaChangedEvent extends BaseDomainEvent<AdenaChangedPayload> {
    readonly type = 'inventory.adena_changed';

    constructor(payload: AdenaChangedPayload, objectId: ObjectId) {
        super(payload, objectId);
    }
}
