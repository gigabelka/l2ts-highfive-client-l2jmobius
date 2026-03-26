/**
 * @fileoverview InMemoryInventoryRepository - in-memory реализация репозитория инвентаря
 * @module infrastructure/persistence
 */

import { Result } from '../../shared/result';
import type { InventoryItem } from '../../domain/entities';
import {
    IInventoryRepository,
    InventoryRepositoryError,
    type InventoryState,
} from '../../domain/repositories';

/**
 * In-memory реализация репозитория инвентаря
 */
export class InMemoryInventoryRepository implements IInventoryRepository {
    private adena = 0;
    private weight = { current: 0, max: 0 };
    private items = new Map<number, InventoryItem>();

    getState(): InventoryState {
        return {
            adena: this.adena,
            weight: { ...this.weight },
            items: Array.from(this.items.values()),
        };
    }

    setState(state: InventoryState): void {
        this.adena = state.adena;
        this.weight = { ...state.weight };
        this.items = new Map(state.items.map((item) => [item.id, item]));
    }

    addOrUpdateItem(item: InventoryItem): void {
        this.items.set(item.id, item);
    }

    getItem(objectId: number): InventoryItem | undefined {
        return this.items.get(objectId);
    }

    getItemsByItemId(itemId: number): InventoryItem[] {
        return Array.from(this.items.values()).filter((item) => item.itemId === itemId);
    }

    getEquippedItems(): InventoryItem[] {
        return Array.from(this.items.values()).filter((item) => item.equipped);
    }

    getEquippedItemBySlot(slot: number): InventoryItem | undefined {
        return Array.from(this.items.values()).find(
            (item) => item.equipped && item.slot === slot
        );
    }

    removeItem(objectId: number): Result<InventoryItem, InventoryRepositoryError> {
        const item = this.items.get(objectId);
        if (!item) {
            return Result.err(InventoryRepositoryError.itemNotFound(objectId));
        }
        this.items.delete(objectId);
        return Result.ok(item);
    }

    updateAdena(amount: number): void {
        this.adena = Math.max(0, amount);
    }

    addAdena(amount: number): Result<void, InventoryRepositoryError> {
        if (amount < 0) {
            return Result.err(
                new InventoryRepositoryError('Cannot add negative adena', 'INVALID_AMOUNT')
            );
        }
        this.adena += amount;
        return Result.ok(undefined);
    }

    removeAdena(amount: number): Result<void, InventoryRepositoryError> {
        if (amount < 0) {
            return Result.err(
                new InventoryRepositoryError('Cannot remove negative adena', 'INVALID_AMOUNT')
            );
        }
        if (this.adena < amount) {
            return Result.err(
                InventoryRepositoryError.insufficientAdena(amount, this.adena)
            );
        }
        this.adena -= amount;
        return Result.ok(undefined);
    }

    getAdena(): number {
        return this.adena;
    }

    equipItem(objectId: number): Result<InventoryItem, InventoryRepositoryError> {
        const item = this.items.get(objectId);
        if (!item) {
            return Result.err(InventoryRepositoryError.itemNotFound(objectId));
        }

        const equipped = item.equip();
        this.items.set(objectId, equipped);
        return Result.ok(equipped);
    }

    unequipItem(objectId: number): Result<InventoryItem, InventoryRepositoryError> {
        const item = this.items.get(objectId);
        if (!item) {
            return Result.err(InventoryRepositoryError.itemNotFound(objectId));
        }

        const unequipped = item.unequip();
        this.items.set(objectId, unequipped);
        return Result.ok(unequipped);
    }

    clear(): void {
        this.adena = 0;
        this.weight = { current: 0, max: 0 };
        this.items.clear();
    }

    reset(): void {
        this.clear();
    }

    /**
     * Получить статистику инвентаря
     */
    getStats(): {
        totalItems: number;
        equippedItems: number;
        adena: number;
        weightPercent: number;
    } {
        const equippedItems = Array.from(this.items.values()).filter((i) => i.equipped).length;
        return {
            totalItems: this.items.size,
            equippedItems,
            adena: this.adena,
            weightPercent:
                this.weight.max > 0
                    ? Math.round((this.weight.current / this.weight.max) * 100)
                    : 0,
        };
    }
}

// Singleton exports удалены - используйте DI контейнер для получения инстансов
// Пример: container.resolve<IInventoryRepository>(DI_TOKENS.InventoryRepository)
