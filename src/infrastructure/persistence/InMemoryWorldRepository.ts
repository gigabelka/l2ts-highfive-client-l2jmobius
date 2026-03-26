/**
 * @fileoverview InMemoryWorldRepository - in-memory реализация репозитория мира
 * @module infrastructure/persistence
 */

import { Result } from '../../shared/result';
import type { Npc, WorldItem } from '../../domain/entities';
import {
    IWorldRepository,
    WorldRepositoryError,
    type NearbyFilter,
    type WorldSnapshot,
} from '../../domain/repositories';
import { Position } from '../../domain/value-objects';

/**
 * In-memory реализация репозитория мира
 */
export class InMemoryWorldRepository implements IWorldRepository {
    private npcs = new Map<number, Npc>();
    private items = new Map<number, WorldItem>();

    // ============================================================================
    // NPC Operations
    // ============================================================================

    saveNpc(npc: Npc): void {
        this.npcs.set(npc.id, npc);
    }

    getNpc(objectId: number): Npc | undefined {
        return this.npcs.get(objectId);
    }

    getAllNpcs(): Npc[] {
        return Array.from(this.npcs.values());
    }

    removeNpc(objectId: number): boolean {
        const npc = this.npcs.get(objectId);
        if (npc) {
            npc.markAsDespawned();
            return this.npcs.delete(objectId);
        }
        return false;
    }

    getNearbyNpcs(
        position: Position,
        radius: number,
        filter?: NearbyFilter
    ): Array<Npc & { distance: number }> {
        const result: Array<Npc & { distance: number }> = [];

        for (const npc of this.npcs.values()) {
            const distance = position.distanceTo(npc.position);
            if (distance > radius) continue;

            if (filter?.attackable !== undefined && npc.isAttackable !== filter.attackable) {
                continue;
            }

            if (filter?.alive !== undefined) {
                const isAlive = npc.isAlive;
                if (isAlive !== filter.alive) continue;
            }

            if (filter?.aggressive !== undefined && npc.isAggressive !== filter.aggressive) {
                continue;
            }

            result.push(Object.assign(npc, { distance }));
        }

        // Сортируем по расстоянию
        return result.sort((a, b) => a.distance - b.distance);
    }

    updateNpc(
        objectId: number,
        updater: (npc: Npc) => Npc
    ): Result<Npc, WorldRepositoryError> {
        const npc = this.npcs.get(objectId);
        if (!npc) {
            return Result.err(WorldRepositoryError.npcNotFound(objectId));
        }

        const updated = updater(npc);
        this.npcs.set(objectId, updated);
        return Result.ok(updated);
    }

    // ============================================================================
    // Item Operations
    // ============================================================================

    saveItem(item: WorldItem): void {
        this.items.set(item.id, item);
    }

    getItem(objectId: number): WorldItem | undefined {
        return this.items.get(objectId);
    }

    getAllItems(): WorldItem[] {
        return Array.from(this.items.values());
    }

    removeItem(objectId: number): boolean {
        return this.items.delete(objectId);
    }

    getNearbyItems(
        position: Position,
        radius: number
    ): Array<WorldItem & { distance: number }> {
        const result: Array<WorldItem & { distance: number }> = [];

        for (const item of this.items.values()) {
            const distance = position.distanceTo(item.position);
            if (distance <= radius) {
                result.push(Object.assign(item, { distance }));
            }
        }

        return result.sort((a, b) => a.distance - b.distance);
    }

    // ============================================================================
    // Snapshot Operations
    // ============================================================================

    getSnapshot(): WorldSnapshot {
        return {
            npcs: new Map(this.npcs),
            items: new Map(this.items),
        };
    }

    restoreSnapshot(snapshot: WorldSnapshot): void {
        this.npcs = new Map(snapshot.npcs);
        this.items = new Map(snapshot.items);
    }

    clear(): void {
        this.npcs.clear();
        this.items.clear();
    }

    reset(): void {
        this.clear();
    }

    /**
     * Получить статистику
     */
    getStats(): { npcCount: number; itemCount: number } {
        return {
            npcCount: this.npcs.size,
            itemCount: this.items.size,
        };
    }
}

// Singleton exports удалены - используйте DI контейнер для получения инстансов
// Пример: container.resolve<IWorldRepository>(DI_TOKENS.WorldRepository)
