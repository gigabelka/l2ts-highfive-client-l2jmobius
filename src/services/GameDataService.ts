/**
 * @fileoverview Сервис для работы с игровыми данными с кэшированием
 * @module services/GameDataService
 */

import type { ICacheManager } from '../infrastructure/cache/ICacheManager';
import type {
    Item,
    Npc,
    Skill,
    ArmorSet,
    Pet,
    Henna,
    SkillTree,
    ClassTemplates,
    FishingData,
    AugmentationData
} from '../data/types';

// Import JSON data directly (will be cached after first access)
import armorsetsJson from '../data/export/armorsets/armorsets.json';
import itemsJson from '../data/export/items/items.json';
import npcsJson from '../data/export/npcs/npcs.json';
import skillsJson from '../data/export/skills/skills.json';
import skillTreesJson from '../data/export/players/skillTrees.json';
import classTemplatesJson from '../data/export/players/classTemplates.json';
import petsJson from '../data/export/pets/pets.json';
import fishingJson from '../data/export/fishing/fishing.json';
import hennaJson from '../data/export/henna.json';
import augmentationJson from '../data/export/augmentation/augmentation.json';

// Helper to extract array from JSON import
const extractArray = <T>(json: unknown): T[] => Array.isArray(json) ? json : (json as { default?: T[] }).default || [];
const extractObject = <T>(json: unknown): T => (json as { default?: T }).default || (json as T);

/**
 * Сервис для работы с игровыми данными с кэшированием
 * Обеспечивает быстрый доступ к items, npcs, skills и другим данным
 */
export class GameDataService {
    // TTL constants (in seconds)
    private static readonly TTL_ITEM = 300;        // 5 minutes
    private static readonly TTL_NPC = 600;         // 10 minutes
    private static readonly TTL_SKILL = 300;       // 5 minutes
    private static readonly TTL_SEARCH_RESULTS = 60; // 1 minute
    private static readonly TTL_ALL_DATA = 3600;   // 1 hour

    // In-memory lookup maps (created once, never changes)
    private itemById: Map<number, Item>;
    private npcById: Map<number, Npc>;
    private skillById: Map<number, Skill>;
    private armorSetById: Map<number, ArmorSet>;
    private petById: Map<number, Pet>;
    private hennaBySymbolId: Map<number, Henna>;

    constructor(private cache: ICacheManager) {
        // Initialize lookup maps synchronously
        const items = extractArray<Item>(itemsJson);
        const npcs = extractArray<Npc>(npcsJson);
        const skills = extractArray<Skill>(skillsJson);
        const armorSets = extractArray<ArmorSet>(armorsetsJson);
        const pets = extractArray<Pet>(petsJson);
        const hennas = extractArray<Henna>(hennaJson);

        this.itemById = new Map(items.map(i => [i.id, i]));
        this.npcById = new Map(npcs.map(n => [n.id, n]));
        this.skillById = new Map(skills.map(s => [s.id, s]));
        this.armorSetById = new Map(armorSets.map(s => [s.id, s]));
        this.petById = new Map(pets.map(p => [p.id, p]));
        this.hennaBySymbolId = new Map(hennas.map(h => [h.symbolId, h]));
    }

    // ============ Item Methods ============

    /**
     * Получить предмет по ID (O(1) из Map)
     */
    async getItem(id: number): Promise<Item | undefined> {
        const cacheKey = `item:${id}`;
        const cached = await this.cache.get<Item>(cacheKey);

        if (cached) {
            return cached;
        }

        const item = this.itemById.get(id);

        if (item) {
            await this.cache.set(cacheKey, item, GameDataService.TTL_ITEM);
        }

        return item;
    }

    /**
     * Получить все предметы
     */
    async getAllItems(): Promise<Item[]> {
        const cacheKey = 'all_items';
        const cached = await this.cache.get<Item[]>(cacheKey);

        if (cached) {
            return cached;
        }

        const items = Array.from(this.itemById.values());
        await this.cache.set(cacheKey, items, GameDataService.TTL_ALL_DATA);

        return items;
    }

    /**
     * Найти предметы по имени (частичное совпадение) с кэшированием результатов поиска
     */
    async findItemsByName(name: string): Promise<Item[]> {
        const cacheKey = `items:search:${name.toLowerCase()}`;
        const cached = await this.cache.get<Item[]>(cacheKey);

        if (cached) {
            return cached;
        }

        const lower = name.toLowerCase();
        const items = Array.from(this.itemById.values())
            .filter(i => i.name.toLowerCase().includes(lower));

        await this.cache.set(cacheKey, items, GameDataService.TTL_SEARCH_RESULTS);

        return items;
    }

    /**
     * Получить предметы по грейду
     */
    async getItemsByGrade(grade: string): Promise<Item[]> {
        const cacheKey = `items:grade:${grade.toUpperCase()}`;
        const cached = await this.cache.get<Item[]>(cacheKey);

        if (cached) {
            return cached;
        }

        const items = Array.from(this.itemById.values())
            .filter(i => i.crystalType === grade.toUpperCase());

        await this.cache.set(cacheKey, items, GameDataService.TTL_ALL_DATA);

        return items;
    }

    // ============ NPC Methods ============

    /**
     * Получить NPC по ID (O(1) из Map)
     */
    async getNpc(id: number): Promise<Npc | undefined> {
        const cacheKey = `npc:${id}`;
        const cached = await this.cache.get<Npc>(cacheKey);

        if (cached) {
            return cached;
        }

        const npc = this.npcById.get(id);

        if (npc) {
            await this.cache.set(cacheKey, npc, GameDataService.TTL_NPC);
        }

        return npc;
    }

    /**
     * Получить всех NPC
     */
    async getAllNpcs(): Promise<Npc[]> {
        const cacheKey = 'all_npcs';
        const cached = await this.cache.get<Npc[]>(cacheKey);

        if (cached) {
            return cached;
        }

        const npcs = Array.from(this.npcById.values());
        await this.cache.set(cacheKey, npcs, GameDataService.TTL_ALL_DATA);

        return npcs;
    }

    /**
     * Найти NPC по имени (частичное совпадение) с кэшированием
     */
    async findNpcsByName(name: string): Promise<Npc[]> {
        const cacheKey = `npcs:search:${name.toLowerCase()}`;
        const cached = await this.cache.get<Npc[]>(cacheKey);

        if (cached) {
            return cached;
        }

        const lower = name.toLowerCase();
        const npcs = Array.from(this.npcById.values())
            .filter(n => n.name.toLowerCase().includes(lower));

        await this.cache.set(cacheKey, npcs, GameDataService.TTL_SEARCH_RESULTS);

        return npcs;
    }

    /**
     * Получить дроп с NPC с кэшированием
     */
    async getNpcDrops(npcId: number): Promise<{ item: Item | undefined; drop: Npc['drops'][0] }[]> {
        const cacheKey = `npc:${npcId}:drops`;
        const cached = await this.cache.get<{ item: Item | undefined; drop: Npc['drops'][0] }[]>(cacheKey);

        if (cached) {
            return cached;
        }

        const npc = this.npcById.get(npcId);
        if (!npc) {
            return [];
        }

        const drops = npc.drops.map(d => ({
            item: this.itemById.get(d.itemId),
            drop: d
        }));

        await this.cache.set(cacheKey, drops, GameDataService.TTL_NPC);

        return drops;
    }

    // ============ Skill Methods ============

    /**
     * Получить скилл по ID (O(1) из Map)
     */
    async getSkill(id: number): Promise<Skill | undefined> {
        const cacheKey = `skill:${id}`;
        const cached = await this.cache.get<Skill>(cacheKey);

        if (cached) {
            return cached;
        }

        const skill = this.skillById.get(id);

        if (skill) {
            await this.cache.set(cacheKey, skill, GameDataService.TTL_SKILL);
        }

        return skill;
    }

    /**
     * Получить все скиллы
     */
    async getAllSkills(): Promise<Skill[]> {
        const cacheKey = 'all_skills';
        const cached = await this.cache.get<Skill[]>(cacheKey);

        if (cached) {
            return cached;
        }

        const skills = Array.from(this.skillById.values());
        await this.cache.set(cacheKey, skills, GameDataService.TTL_ALL_DATA);

        return skills;
    }

    /**
     * Найти скиллы по имени (частичное совпадение) с кэшированием
     */
    async findSkillsByName(name: string): Promise<Skill[]> {
        const cacheKey = `skills:search:${name.toLowerCase()}`;
        const cached = await this.cache.get<Skill[]>(cacheKey);

        if (cached) {
            return cached;
        }

        const lower = name.toLowerCase();
        const skills = Array.from(this.skillById.values())
            .filter(s => s.name.toLowerCase().includes(lower));

        await this.cache.set(cacheKey, skills, GameDataService.TTL_SEARCH_RESULTS);

        return skills;
    }

    /**
     * Получить активные скиллы
     */
    async getActiveSkills(): Promise<Skill[]> {
        const cacheKey = 'skills:active';
        const cached = await this.cache.get<Skill[]>(cacheKey);

        if (cached) {
            return cached;
        }

        const skills = Array.from(this.skillById.values())
            .filter(s => s.type === 'ACTIVE');

        await this.cache.set(cacheKey, skills, GameDataService.TTL_ALL_DATA);

        return skills;
    }

    /**
     * Получить пассивные скиллы
     */
    async getPassiveSkills(): Promise<Skill[]> {
        const cacheKey = 'skills:passive';
        const cached = await this.cache.get<Skill[]>(cacheKey);

        if (cached) {
            return cached;
        }

        const skills = Array.from(this.skillById.values())
            .filter(s => s.type === 'PASSIVE');

        await this.cache.set(cacheKey, skills, GameDataService.TTL_ALL_DATA);

        return skills;
    }

    // ============ Armor Set Methods ============

    /**
     * Получить Armor Set по ID
     */
    async getArmorSet(id: number): Promise<ArmorSet | undefined> {
        const cacheKey = `armorset:${id}`;
        const cached = await this.cache.get<ArmorSet>(cacheKey);

        if (cached) {
            return cached;
        }

        const set = this.armorSetById.get(id);

        if (set) {
            await this.cache.set(cacheKey, set, GameDataService.TTL_ALL_DATA);
        }

        return set;
    }

    /**
     * Получить скиллы сета брони
     */
    async getArmorSetSkills(setId: number): Promise<Skill[]> {
        const cacheKey = `armorset:${setId}:skills`;
        const cached = await this.cache.get<Skill[]>(cacheKey);

        if (cached) {
            return cached;
        }

        const set = this.armorSetById.get(setId);
        if (!set) {
            return [];
        }

        const setSkills = set.skills
            .map(s => this.skillById.get(s.id))
            .filter((s): s is Skill => s !== undefined);

        await this.cache.set(cacheKey, setSkills, GameDataService.TTL_ALL_DATA);

        return setSkills;
    }

    // ============ Other Data Methods ============

    /**
     * Получить питомца по ID
     */
    async getPet(id: number): Promise<Pet | undefined> {
        const cacheKey = `pet:${id}`;
        const cached = await this.cache.get<Pet>(cacheKey);

        if (cached) {
            return cached;
        }

        const pet = this.petById.get(id);

        if (pet) {
            await this.cache.set(cacheKey, pet, GameDataService.TTL_ALL_DATA);
        }

        return pet;
    }

    /**
     * Получить хенну по symbolId
     */
    async getHenna(symbolId: number): Promise<Henna | undefined> {
        const cacheKey = `henna:${symbolId}`;
        const cached = await this.cache.get<Henna>(cacheKey);

        if (cached) {
            return cached;
        }

        const henna = this.hennaBySymbolId.get(symbolId);

        if (henna) {
            await this.cache.set(cacheKey, henna, GameDataService.TTL_ALL_DATA);
        }

        return henna;
    }

    /**
     * Получить дерево умений для класса
     */
    async getSkillTree(className: string): Promise<SkillTree[string] | undefined> {
        const cacheKey = `skilltree:${className}`;
        const cached = await this.cache.get<SkillTree[string]>(cacheKey);

        if (cached) {
            return cached;
        }

        const tree = extractObject<SkillTree>(skillTreesJson)[className];

        if (tree) {
            await this.cache.set(cacheKey, tree, GameDataService.TTL_ALL_DATA);
        }

        return tree;
    }

    /**
     * Получить шаблон класса
     */
    async getClassTemplate(className: string): Promise<ClassTemplates[string] | undefined> {
        const cacheKey = `classtemplate:${className}`;
        const cached = await this.cache.get<ClassTemplates[string]>(cacheKey);

        if (cached) {
            return cached;
        }

        const template = extractObject<ClassTemplates>(classTemplatesJson)[className];

        if (template) {
            await this.cache.set(cacheKey, template, GameDataService.TTL_ALL_DATA);
        }

        return template;
    }

    /**
     * Получить данные рыбалки
     */
    async getFishingData(): Promise<FishingData> {
        const cacheKey = 'fishing_data';
        const cached = await this.cache.get<FishingData>(cacheKey);

        if (cached) {
            return cached;
        }

        const data = extractObject<FishingData>(fishingJson);
        await this.cache.set(cacheKey, data, GameDataService.TTL_ALL_DATA);

        return data;
    }

    /**
     * Получить данные аугментации
     */
    async getAugmentationData(): Promise<AugmentationData> {
        const cacheKey = 'augmentation_data';
        const cached = await this.cache.get<AugmentationData>(cacheKey);

        if (cached) {
            return cached;
        }

        const data = extractObject<AugmentationData>(augmentationJson);
        await this.cache.set(cacheKey, data, GameDataService.TTL_ALL_DATA);

        return data;
    }

    // ============ Statistics ============

    /**
     * Получить статистику кэша
     */
    getCacheStats() {
        return this.cache.getStats();
    }

    /**
     * Получить общую статистику данных
     */
    getDataStats() {
        return {
            items: this.itemById.size,
            npcs: this.npcById.size,
            skills: this.skillById.size,
            armorSets: this.armorSetById.size,
            pets: this.petById.size,
            hennas: this.hennaBySymbolId.size,
            cache: this.getCacheStats()
        };
    }

    /**
     * Инвалидировать все кэшированные данные
     */
    async invalidateCache(): Promise<void> {
        await this.cache.flush();
    }
}
