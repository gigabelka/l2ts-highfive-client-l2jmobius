// src/data/SkillDatabase.ts
// Адаптер для обратной совместимости с существующим кодом
// Использует нормализованные данные из loader.ts

import { skills, skillById, findSkillsByName } from './loader';
import type { Skill } from './types';

/**
 * SkillDatabase - singleton для доступа к данным скиллов
 * Обеспечивает обратную совместимость со старым API
 */
export class SkillDatabase {
    private static instance: SkillDatabase;

    private constructor() {}

    public static getInstance(): SkillDatabase {
        if (!SkillDatabase.instance) {
            SkillDatabase.instance = new SkillDatabase();
        }
        return SkillDatabase.instance;
    }

    /**
     * Получить скилл по ID
     */
    public static getSkill(id: number): Skill | undefined {
        return skillById.get(id);
    }

    /**
     * Получить название скилла
     */
    public static getSkillName(id: number): string | undefined {
        return skillById.get(id)?.name;
    }

    /**
     * Получить тип скилла
     */
    public static getSkillType(id: number): string | undefined {
        return skillById.get(id)?.type;
    }

    /**
     * Проверить, является ли скилл пассивным
     */
    public static isPassive(id: number): boolean {
        return skillById.get(id)?.isPassive ?? false;
    }

    /**
     * Получить максимальный уровень скилла
     */
    public static getMaxLevel(id: number): number {
        return skillById.get(id)?.maxLevel ?? 1;
    }

    /**
     * Найти скиллы по имени
     */
    public static findByName(name: string): Skill[] {
        return findSkillsByName(name);
    }

    /**
     * Получить все скиллы
     */
    public static getAll(): Skill[] {
        return skills;
    }

    /**
     * Получить количество скиллов
     */
    public static get count(): number {
        return skills.length;
    }
}

// Экспорт синглтона для удобства
export const SkillDatabaseInstance = SkillDatabase.getInstance();
