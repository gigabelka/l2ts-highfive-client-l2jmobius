/**
 * @fileoverview IInventoryRepository - порт для хранения инвентаря
 * @module domain/repositories
 */

import type { InventoryItem } from '../entities';
import type { Result } from '../../shared/result';

export interface InventoryState {
    adena: number;
    weight: {
        current: number;
        max: number;
    };
    items: InventoryItem[];
}

/**
 * Ошибки репозитория инвентаря
 */
export class InventoryRepositoryError extends Error {
    constructor(message: string, public readonly code: string) {
        super(message);
        this.name = 'InventoryRepositoryError';
    }

    static itemNotFound(objectId: number): InventoryRepositoryError {
        return new InventoryRepositoryError(
            `Item with objectId ${objectId} not found`,
            'ITEM_NOT_FOUND'
        );
    }

    static insufficientAdena(required: number, available: number): InventoryRepositoryError {
        return new InventoryRepositoryError(
            `Insufficient adena: required ${required}, available ${available}`,
            'INSUFFICIENT_ADENA'
        );
    }

    static slotOccupied(slot: number): InventoryRepositoryError {
        return new InventoryRepositoryError(
            `Slot ${slot} is already occupied`,
            'SLOT_OCCUPIED'
        );
    }
}

/**
 * Порт для репозитория инвентаря
 */
export interface IInventoryRepository {
    /**
     * Получить текущее состояние инвентаря
     */
    getState(): InventoryState;

    /**
     * Установить полное состояние (например, при загрузке ItemList)
     */
    setState(state: InventoryState): void;

    /**
     * Добавить или обновить предмет
     */
    addOrUpdateItem(item: InventoryItem): void;

    /**
     * Получить предмет по objectId
     */
    getItem(objectId: number): InventoryItem | undefined;

    /**
     * Получить предметы по itemId
     */
    getItemsByItemId(itemId: number): InventoryItem[];

    /**
     * Получить экипированные предметы
     */
    getEquippedItems(): InventoryItem[];

    /**
     * Получить предмет в конкретном слоте
     */
    getEquippedItemBySlot(slot: number): InventoryItem | undefined;

    /**
     * Удалить предмет
     */
    removeItem(objectId: number): Result<InventoryItem, InventoryRepositoryError>;

    /**
     * Обновить количество адены
     */
    updateAdena(amount: number): void;

    /**
     * Добавить адену
     */
    addAdena(amount: number): Result<void, InventoryRepositoryError>;

    /**
     * Списать адену
     */
    removeAdena(amount: number): Result<void, InventoryRepositoryError>;

    /**
     * Получить количество адены
     */
    getAdena(): number;

    /**
     * Экипировать предмет
     */
    equipItem(objectId: number): Result<InventoryItem, InventoryRepositoryError>;

    /**
     * Снять экипировку
     */
    unequipItem(objectId: number): Result<InventoryItem, InventoryRepositoryError>;

    /**
     * Очистить инвентарь
     */
    clear(): void;

    /**
     * Сбросить состояние
     */
    reset(): void;
}
