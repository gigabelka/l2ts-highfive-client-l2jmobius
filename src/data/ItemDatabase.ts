// src/data/ItemDatabase.ts
// Адаптер для доступа к данным предметов
// Использует нормализованные данные из loader.ts

import { items, itemById, findItemsByName } from './loader';
import type { Item } from './types';

/**
 * ItemDatabase - singleton для доступа к данным предметов
 */
export class ItemDatabase {
    private static instance: ItemDatabase;

    private constructor() {}

    public static getInstance(): ItemDatabase {
        if (!ItemDatabase.instance) {
            ItemDatabase.instance = new ItemDatabase();
        }
        return ItemDatabase.instance;
    }

    /**
     * Получить предмет по ID
     */
    public static getItem(id: number): Item | undefined {
        return itemById.get(id);
    }

    /**
     * Получить название предмета
     */
    public static getItemName(id: number): string | undefined {
        return itemById.get(id)?.name;
    }

    /**
     * Получить тип предмета
     */
    public static getItemType(id: number): string | undefined {
        return itemById.get(id)?.type;
    }

    /**
     * Проверить, является ли предмет оружием
     */
    public static isWeapon(id: number): boolean {
        return itemById.get(id)?.type === 'Weapon';
    }

    /**
     * Проверить, является ли предмет броней
     */
    public static isArmor(id: number): boolean {
        return itemById.get(id)?.type === 'Armor';
    }

    /**
     * Проверить, является ли предмет расходником
     */
    public static isEtcItem(id: number): boolean {
        return itemById.get(id)?.type === 'EtcItem';
    }

    /**
     * Получить грейд предмета (кристалл)
     */
    public static getGrade(id: number): string | undefined {
        return itemById.get(id)?.crystalType;
    }

    /**
     * Получить цену предмета
     */
    public static getPrice(id: number): number {
        return itemById.get(id)?.price ?? 0;
    }

    /**
     * Получить вес предмета
     */
    public static getWeight(id: number): number {
        return itemById.get(id)?.weight ?? 0;
    }

    /**
     * Проверить, можно ли кристаллизовать предмет
     */
    public static isCrystallizable(id: number): boolean {
        return itemById.get(id)?.crystallizable ?? false;
    }

    /**
     * Получить скиллы предмета
     */
    public static getItemSkills(id: number): Item['skills'] {
        return itemById.get(id)?.skills ?? [];
    }

    /**
     * Получить статы предмета
     */
    public static getItemStats(id: number): Record<string, number> | undefined {
        return itemById.get(id)?.stats;
    }

    /**
     * Найти предметы по имени (частичное совпадение)
     */
    public static findByName(name: string): Item[] {
        return findItemsByName(name);
    }

    /**
     * Найти предметы по грейду
     */
    public static findByGrade(grade: string): Item[] {
        return items.filter(i => i.crystalType === grade.toUpperCase());
    }

    /**
     * Найти предметы по типу
     */
    public static findByType(type: 'Weapon' | 'Armor' | 'EtcItem'): Item[] {
        return items.filter(i => i.type === type);
    }

    /**
     * Найти оружие по типу
     */
    public static findWeaponsByType(weaponType: string): Item[] {
        return items.filter(i => i.type === 'Weapon' && i.weaponType === weaponType);
    }

    /**
     * Найти броню по типу
     */
    public static findArmorByType(armorType: string): Item[] {
        return items.filter(i => i.type === 'Armor' && i.armorType === armorType);
    }

    /**
     * Получить все предметы
     */
    public static getAll(): Item[] {
        return items;
    }

    /**
     * Получить количество предметов
     */
    public static get count(): number {
        return items.length;
    }
}

// Экспорт синглтона для удобства
export const ItemDatabaseInstance = ItemDatabase.getInstance();
