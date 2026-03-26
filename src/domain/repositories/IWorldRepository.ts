/**
 * @fileoverview IWorldRepository - порт для хранения игрового мира
 * @module domain/repositories
 */

import type { Npc, WorldItem } from '../entities';
import type { Position } from '../value-objects';
import type { Result } from '../../shared/result';

export interface NearbyFilter {
    attackable?: boolean;
    alive?: boolean;
    aggressive?: boolean;
}

export interface WorldSnapshot {
    npcs: Map<number, Npc>;
    items: Map<number, WorldItem>;
}

/**
 * Ошибки репозитория мира
 */
export class WorldRepositoryError extends Error {
    constructor(message: string, public readonly code: string) {
        super(message);
        this.name = 'WorldRepositoryError';
    }

    static npcNotFound(objectId: number): WorldRepositoryError {
        return new WorldRepositoryError(
            `NPC with objectId ${objectId} not found`,
            'NPC_NOT_FOUND'
        );
    }

    static itemNotFound(objectId: number): WorldRepositoryError {
        return new WorldRepositoryError(
            `Item with objectId ${objectId} not found`,
            'ITEM_NOT_FOUND'
        );
    }
}

/**
 * Порт для репозитория мира (NPC и дроп)
 */
export interface IWorldRepository {
    // ============================================================================
    // NPC Operations
    // ============================================================================

    /**
     * Добавить или обновить NPC
     */
    saveNpc(npc: Npc): void;

    /**
     * Получить NPC по ID
     */
    getNpc(objectId: number): Npc | undefined;

    /**
     * Получить всех NPC
     */
    getAllNpcs(): Npc[];

    /**
     * Удалить NPC
     */
    removeNpc(objectId: number): boolean;

    /**
     * Получить NPC в радиусе от позиции
     */
    getNearbyNpcs(position: Position, radius: number, filter?: NearbyFilter): Array<Npc & { distance: number }>;

    /**
     * Обновить NPC
     */
    updateNpc(objectId: number, updater: (npc: Npc) => Npc): Result<Npc, WorldRepositoryError>;

    // ============================================================================
    // Item Operations
    // ============================================================================

    /**
     * Добавить предмет
     */
    saveItem(item: WorldItem): void;

    /**
     * Получить предмет по ID
     */
    getItem(objectId: number): WorldItem | undefined;

    /**
     * Получить все предметы
     */
    getAllItems(): WorldItem[];

    /**
     * Удалить предмет
     */
    removeItem(objectId: number): boolean;

    /**
     * Получить предметы в радиусе
     */
    getNearbyItems(position: Position, radius: number): Array<WorldItem & { distance: number }>;

    // ============================================================================
    // Player Operations (TODO: implement when player entity is created)
    // ============================================================================

    /**
     * Получить игроков в радиусе (placeholder - returns empty array)
     */
    getNearbyPlayers?(position: Position, radius: number): Array<{ id: number; name: string; level: number; classId: number; position: Position; distance: number }>;

    // ============================================================================
    // Snapshot Operations
    // ============================================================================

    /**
     * Получить снапшот состояния мира
     */
    getSnapshot(): WorldSnapshot;

    /**
     * Восстановить состояние из снапшота
     */
    restoreSnapshot(snapshot: WorldSnapshot): void;

    /**
     * Очистить все
     */
    clear(): void;

    /**
     * Сбросить состояние
     */
    reset(): void;
}
