/**
 * @fileoverview Npc - сущность NPC
 * @module domain/entities
 */

import { ObjectId, NpcTemplateId, Position, Vitals } from '../value-objects';
import { NpcSpawnedEvent, NpcDespawnedEvent, NpcInfoUpdatedEvent } from '../events';
import type { DomainEvent } from '../events';

export interface NpcData {
    objectId: number;
    npcId: number;
    name: string;
    title?: string;
    level: number;
    position: Position;
    hp: Vitals;
    isAttackable: boolean;
    isAggressive: boolean;
}

/**
 * Сущность NPC (Non-Player Character)
 */
export class Npc {
    private uncommittedEvents: DomainEvent[] = [];

    constructor(
        readonly objectId: ObjectId,
        readonly templateId: NpcTemplateId,
        private data: NpcData
    ) {}

    // ============================================================================
    // Getters
    // ============================================================================

    get id(): number {
        return this.objectId.value;
    }

    get npcId(): number {
        return this.templateId.value;
    }

    get name(): string {
        return this.data.name;
    }

    get title(): string | undefined {
        return this.data.title;
    }

    get level(): number {
        return this.data.level;
    }

    get position(): Position {
        return this.data.position;
    }

    get hp(): Vitals {
        return this.data.hp;
    }

    get isAttackable(): boolean {
        return this.data.isAttackable;
    }

    get isAggressive(): boolean {
        return this.data.isAggressive;
    }

    get isDead(): boolean {
        return this.data.hp.isEmpty;
    }

    get isAlive(): boolean {
        return !this.isDead;
    }

    get currentHp(): number {
        return this.data.hp.current;
    }

    get maxHp(): number {
        return this.data.hp.max;
    }

    // ============================================================================
    // Domain Operations
    // ============================================================================

    /**
     * Обновить позицию
     */
    updatePosition(position: Position): void {
        this.data.position = position;
        this.uncommittedEvents.push(
            new NpcInfoUpdatedEvent({ objectId: this.id, position })
        );
    }

    /**
     * Обновить HP
     */
    updateHp(current: number, max?: number): void {
        this.data.hp = new Vitals({
            current,
            max: max ?? this.data.hp.max
        });
        this.uncommittedEvents.push(
            new NpcInfoUpdatedEvent({ objectId: this.id, currentHp: current, maxHp: this.data.hp.max })
        );
    }

    /**
     * Отметить как мертвого
     */
    markAsDead(): void {
        this.data.hp = this.data.hp.deplete();
        this.uncommittedEvents.push(
            new NpcDespawnedEvent({ objectId: this.id, reason: 'died' })
        );
    }

    /**
     * Отметить как деспавненного
     */
    markAsDespawned(reason: 'despawned' | 'unknown' = 'despawned'): void {
        this.uncommittedEvents.push(
            new NpcDespawnedEvent({ objectId: this.id, reason })
        );
    }

    /**
     * Умереть (алиас для markAsDead)
     */
    die(): void {
        this.markAsDead();
    }

    /**
     * Воскресить (для респавна NPC)
     */
    revive(): void {
        // HP будет восстановлено при спавне
        this.uncommittedEvents.push(
            new NpcSpawnedEvent({
                objectId: this.id,
                npcId: this.npcId,
                name: this.name,
                level: this.level,
                position: this.position,
                isAttackable: this.isAttackable,
                isAggressive: this.isAggressive,
                maxHp: this.maxHp,
                currentHp: this.maxHp, // Полное восстановление HP
            })
        );
    }

    // ============================================================================
    // Event Sourcing
    // ============================================================================

    getUncommittedEvents(): DomainEvent[] {
        return [...this.uncommittedEvents];
    }

    clearUncommittedEvents(): void {
        this.uncommittedEvents = [];
    }

    // ============================================================================
    // Factory Methods
    // ============================================================================

    static spawn(data: NpcData): { npc: Npc; event: NpcSpawnedEvent } {
        const objectId = ObjectId.of(data.objectId);
        const templateId = NpcTemplateId.create(data.npcId).getOrThrow();
        const npc = new Npc(objectId, templateId, data);

        const event = new NpcSpawnedEvent({
            objectId: data.objectId,
            npcId: data.npcId,
            name: data.name,
            level: data.level,
            position: data.position,
            isAttackable: data.isAttackable,
            isAggressive: data.isAggressive,
            maxHp: data.hp.max,
            currentHp: data.hp.current,
        });

        return { npc, event };
    }

    static create(data: NpcData): Npc {
        return Npc.spawn(data).npc;
    }

    toJSON(): NpcData {
        return {
            objectId: this.data.objectId,
            npcId: this.templateId.value,
            name: this.data.name,
            title: this.data.title,
            level: this.data.level,
            position: this.data.position,
            hp: this.data.hp,
            isAttackable: this.data.isAttackable,
            isAggressive: this.data.isAggressive,
        };
    }
}


