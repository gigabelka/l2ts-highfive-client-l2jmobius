// src/data/loader.ts
// Утилиты для загрузки нормализованных данных

import type {
    ArmorSet,
    Item,
    Npc,
    Skill,
    SkillTree,
    ClassTemplates,
    Pet,
    FishingData,
    Henna,
    AugmentationData
} from './types';

import armorsetsJson from './export/armorsets/armorsets.json';
import itemsJson from './export/items/items.json';
import npcsJson from './export/npcs/npcs.json';
import skillsJson from './export/skills/skills.json';
import skillTreesJson from './export/players/skillTrees.json';
import classTemplatesJson from './export/players/classTemplates.json';
import petsJson from './export/pets/pets.json';
import fishingJson from './export/fishing/fishing.json';
import hennaJson from './export/henna.json';
import augmentationJson from './export/augmentation/augmentation.json';

// Helper to extract array from JSON import (handles __importStar wrapper)
const extractArray = <T>(json: any): T[] => Array.isArray(json) ? json : json.default || [];
const extractObject = <T>(json: any): T => json.default || json;

// ============ Data Exports ============
export const armorSets: ArmorSet[] = extractArray<ArmorSet>(armorsetsJson);
export const items: Item[] = extractArray<Item>(itemsJson);
export const npcs: Npc[] = extractArray<Npc>(npcsJson);
export const skills: Skill[] = extractArray<Skill>(skillsJson);
export const skillTrees: SkillTree = extractObject<SkillTree>(skillTreesJson);
export const classTemplates: ClassTemplates = extractObject<ClassTemplates>(classTemplatesJson);
export const pets: Pet[] = extractArray<Pet>(petsJson);
export const fishing: FishingData = extractObject<FishingData>(fishingJson);
export const hennas: Henna[] = extractArray<Henna>(hennaJson);
export const augmentation: AugmentationData = extractObject<AugmentationData>(augmentationJson);

// ============ Lookup Maps (for fast access) ============
export const armorSetById = new Map(armorSets.map(s => [s.id, s]));
export const itemById = new Map(items.map(i => [i.id, i]));
export const npcById = new Map(npcs.map(n => [n.id, n]));
export const skillById = new Map(skills.map(s => [s.id, s]));
export const petById = new Map(pets.map(p => [p.id, p]));
export const hennaBySymbolId = new Map(hennas.map(h => [h.symbolId, h]));

// ============ Helper Functions ============

/**
 * Получить предмет по ID
 */
export function getItem(id: number): Item | undefined {
    return itemById.get(id);
}

/**
 * Получить NPC по ID
 */
export function getNpc(id: number): Npc | undefined {
    return npcById.get(id);
}

/**
 * Получить скилл по ID
 */
export function getSkill(id: number): Skill | undefined {
    return skillById.get(id);
}

/**
 * Получить Armor Set по ID
 */
export function getArmorSet(id: number): ArmorSet | undefined {
    return armorSetById.get(id);
}

/**
 * Найти скиллы по имени (частичное совпадение)
 */
export function findSkillsByName(name: string): Skill[] {
    const lower = name.toLowerCase();
    return skills.filter(s => s.name.toLowerCase().includes(lower));
}

/**
 * Найти предметы по имени (частичное совпадение)
 */
export function findItemsByName(name: string): Item[] {
    const lower = name.toLowerCase();
    return items.filter(i => i.name.toLowerCase().includes(lower));
}

/**
 * Найти NPC по имени (частичное совпадение)
 */
export function findNpcsByName(name: string): Npc[] {
    const lower = name.toLowerCase();
    return npcs.filter(n => n.name.toLowerCase().includes(lower));
}

/**
 * Получить дерево умений для класса
 */
export function getSkillTree(className: string): SkillTree[string] | undefined {
    return skillTrees[className];
}

/**
 * Получить шаблон класса
 */
export function getClassTemplate(className: string): ClassTemplates[string] | undefined {
    return classTemplates[className];
}

/**
 * Получить питомца по ID
 */
export function getPet(id: number): Pet | undefined {
    return petById.get(id);
}

/**
 * Получить хенну по symbolId
 */
export function getHenna(symbolId: number): Henna | undefined {
    return hennaBySymbolId.get(symbolId);
}

/**
 * Проверить, является ли предмет оружием
 */
export function isWeapon(item: Item): boolean {
    return item.type === 'Weapon';
}

/**
 * Проверить, является ли предмет броней
 */
export function isArmor(item: Item): boolean {
    return item.type === 'Armor';
}

/**
 * Получить все предметы определенного грейда
 */
export function getItemsByGrade(grade: string): Item[] {
    return items.filter(i => i.crystalType === grade.toUpperCase());
}

/**
 * Получить все активные скиллы
 */
export function getActiveSkills(): Skill[] {
    return skills.filter(s => s.type === 'ACTIVE');
}

/**
 * Получить все пассивные скиллы
 */
export function getPassiveSkills(): Skill[] {
    return skills.filter(s => s.type === 'PASSIVE');
}

/**
 * Получить скиллы сета брони
 */
export function getArmorSetSkills(setId: number): Skill[] {
    const set = getArmorSet(setId);
    if (!set) return [];
    return set.skills.map(s => skillById.get(s.id)).filter(Boolean) as Skill[];
}

/**
 * Получить дроп с NPC
 */
export function getNpcDrops(npcId: number): { item: Item | undefined; drop: Npc['drops'][0] }[] {
    const npc = getNpc(npcId);
    if (!npc) return [];
    return npc.drops.map(d => ({ item: getItem(d.itemId), drop: d }));
}

// ============ Statistics ============
export const stats = {
    armorSets: armorSets.length,
    items: items.length,
    npcs: npcs.length,
    skills: skills.length,
    classTemplates: Object.keys(classTemplates).length,
    pets: pets.length,
    hennas: hennas.length
};

// console.log('[DataLoader] Loaded:', stats);
