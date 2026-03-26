// src/data/NpcDatabase.ts
// Адаптер для доступа к данным NPC
// Использует нормализованные данные из loader.ts

import { npcs, npcById, findNpcsByName } from './loader';
import type { Npc } from './types';

/**
 * NpcDatabase - singleton для доступа к данным NPC
 */
export class NpcDatabase {
    private static instance: NpcDatabase;

    private constructor() {}

    public static getInstance(): NpcDatabase {
        if (!NpcDatabase.instance) {
            NpcDatabase.instance = new NpcDatabase();
        }
        return NpcDatabase.instance;
    }

    /**
     * Получить NPC по ID
     */
    public static getNpc(id: number): Npc | undefined {
        return npcById.get(id);
    }

    /**
     * Получить название NPC
     */
    public static getNpcName(id: number): string | undefined {
        return npcById.get(id)?.name;
    }

    /**
     * Получить титул NPC
     */
    public static getNpcTitle(id: number): string | undefined {
        return npcById.get(id)?.title;
    }

    /**
     * Получить уровень NPC
     */
    public static getNpcLevel(id: number): number {
        return npcById.get(id)?.level ?? 0;
    }

    /**
     * Получить тип NPC
     */
    public static getNpcType(id: number): string | undefined {
        return npcById.get(id)?.type;
    }

    /**
     * Получить статы NPC
     */
    public static getNpcStats(id: number): Npc['stats'] | undefined {
        return npcById.get(id)?.stats;
    }

    /**
     * Получить дроп с NPC
     */
    public static getNpcDrops(id: number): Npc['drops'] {
        return npcById.get(id)?.drops ?? [];
    }

    /**
     * Получить спойл с NPC
     */
    public static getNpcSpoil(id: number): Npc['spoil'] {
        return npcById.get(id)?.spoil ?? [];
    }

    /**
     * Найти NPC по имени (частичное совпадение)
     */
    public static findByName(name: string): Npc[] {
        return findNpcsByName(name);
    }

    /**
     * Найти NPC по типу
     */
    public static findByType(type: string): Npc[] {
        return npcs.filter(n => n.type.toLowerCase() === type.toLowerCase());
    }

    /**
     * Найти NPC по уровню (в диапазоне)
     */
    public static findByLevelRange(minLevel: number, maxLevel: number): Npc[] {
        return npcs.filter(n => n.level >= minLevel && n.level <= maxLevel);
    }

    /**
     * Получить всех NPC
     */
    public static getAll(): Npc[] {
        return npcs;
    }

    /**
     * Получить количество NPC
     */
    public static get count(): number {
        return npcs.length;
    }
}

// Экспорт синглтона для удобства
export const NpcDatabaseInstance = NpcDatabase.getInstance();
