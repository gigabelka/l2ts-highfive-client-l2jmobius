/**
 * @fileoverview World Events - события игрового мира
 * @module domain/events
 */

import { BaseDomainEvent } from './DomainEvent';
import { Position, ObjectId } from '../value-objects';

// =============================================================================
// NPC Events
// =============================================================================

export interface NpcSpawnedPayload {
    objectId: number;
    npcId: number;
    name: string;
    level: number;
    position: Position;
    isAttackable: boolean;
    isAggressive: boolean;
    maxHp: number;
    currentHp: number;
}

export class NpcSpawnedEvent extends BaseDomainEvent<NpcSpawnedPayload> {
    readonly type = 'world.npc_spawned';

    constructor(payload: NpcSpawnedPayload) {
        super(payload, ObjectId.of(payload.objectId));
    }
}

export interface NpcDespawnedPayload {
    objectId: number;
    reason: 'died' | 'despawned' | 'unknown';
}

export class NpcDespawnedEvent extends BaseDomainEvent<NpcDespawnedPayload> {
    readonly type = 'world.npc_despawned';

    constructor(payload: NpcDespawnedPayload) {
        super(payload, ObjectId.of(payload.objectId));
    }
}

export interface NpcInfoUpdatedPayload {
    objectId: number;
    currentHp?: number;
    maxHp?: number;
    position?: Position;
}

export class NpcInfoUpdatedEvent extends BaseDomainEvent<NpcInfoUpdatedPayload> {
    readonly type = 'world.npc_updated';

    constructor(payload: NpcInfoUpdatedPayload) {
        super(payload, ObjectId.of(payload.objectId));
    }
}

// =============================================================================
// Player Events
// =============================================================================

export interface PlayerSpawnedPayload {
    objectId: number;
    name: string;
    level: number;
    classId: number;
    position: Position;
}

export class PlayerSpawnedEvent extends BaseDomainEvent<PlayerSpawnedPayload> {
    readonly type = 'world.player_spawned';

    constructor(payload: PlayerSpawnedPayload) {
        super(payload, ObjectId.of(payload.objectId));
    }
}

export interface PlayerDespawnedPayload {
    objectId: number;
}

export class PlayerDespawnedEvent extends BaseDomainEvent<PlayerDespawnedPayload> {
    readonly type = 'world.player_despawned';

    constructor(payload: PlayerDespawnedPayload) {
        super(payload, ObjectId.of(payload.objectId));
    }
}

// =============================================================================
// Item/Drop Events
// =============================================================================

export interface ItemDroppedPayload {
    objectId: number;
    itemId: number;
    name: string;
    count: number;
    position: Position;
    droppedById?: number;
}

export class ItemDroppedEvent extends BaseDomainEvent<ItemDroppedPayload> {
    readonly type = 'world.item_dropped';

    constructor(payload: ItemDroppedPayload) {
        super(payload, ObjectId.of(payload.objectId));
    }
}

export interface ItemPickedUpPayload {
    objectId: number;
    pickedById: number;
    pickedByName?: string;
}

export class ItemPickedUpEvent extends BaseDomainEvent<ItemPickedUpPayload> {
    readonly type = 'world.item_picked_up';

    constructor(payload: ItemPickedUpPayload) {
        super(payload, ObjectId.of(payload.objectId));
    }
}

// =============================================================================
// Combat Events
// =============================================================================

export interface AttackPayload {
    attackerId: number;
    attackerName?: string;
    targetId: number;
    targetName?: string;
    damage?: number;
    isCritical?: boolean;
    isMiss?: boolean;
}

export class AttackEvent extends BaseDomainEvent<AttackPayload> {
    readonly type = 'combat.attack';

    constructor(payload: AttackPayload) {
        super(payload, ObjectId.of(payload.attackerId));
    }
}

export interface SkillUsePayload {
    casterId: number;
    casterName?: string;
    targetId: number;
    targetName?: string;
    skillId: number;
    skillName?: string;
    skillLevel: number;
    castTime: number;
}

export class SkillUseEvent extends BaseDomainEvent<SkillUsePayload> {
    readonly type = 'combat.skill_use';

    constructor(payload: SkillUsePayload) {
        super(payload, ObjectId.of(payload.casterId));
    }
}

export interface TargetDiedPayload {
    targetId: number;
    targetName?: string;
    killerId?: number;
    killerName?: string;
}

export class TargetDiedEvent extends BaseDomainEvent<TargetDiedPayload> {
    readonly type = 'combat.target_died';

    constructor(payload: TargetDiedPayload) {
        super(payload, payload.killerId ? ObjectId.of(payload.killerId) : undefined);
    }
}
