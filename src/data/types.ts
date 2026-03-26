// src/data/types.ts
// TypeScript типы для нормализованных данных L2J Mobius

// ============ Armor Sets ============
export interface ArmorSet {
    id: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'S' | 'NO' | 'CLAN';
    items: {
        chest: number | null;
        legs: number | null;
        head: number | null;
        gloves: number | null;
        feet: number | null;
        shield: number | null;
    };
    skills: SkillRef[];
    shieldSkill: SkillRef | null;
    enchant6Skill: SkillRef | null;
    stats: Partial<Record<Stat, number>>;
}

interface SkillRef {
    id: number;
    level: number;
}

type Stat = 'str' | 'con' | 'dex' | 'int' | 'wit' | 'men';

// ============ Items ============
export interface Item {
    id: number;
    name: string;
    type: 'Weapon' | 'Armor' | 'EtcItem' | 'NONE';
    material: string | null;
    weight: number;
    price: number;
    crystallizable: boolean;
    crystalType: string;
    crystalCount: number;
    duration: number;
    stats: Record<string, number>;
    skills: ItemSkill[];
    // Weapon specific
    weaponType?: string;
    soulshots?: number;
    spiritshots?: number;
    pAtk?: number;
    mAtk?: number;
    atkSpeed?: number;
    critical?: number;
    hitModify?: number;
    avoidModify?: number;
    // Armor specific
    armorType?: string;
    pDef?: number;
    mDef?: number;
    mpBonus?: number;
}

interface ItemSkill {
    id: number;
    level: number;
    type: string;
}

// ============ NPCs ============
export interface Npc {
    id: number;
    name: string;
    title: string;
    type: string;
    level: number;
    stats: NpcStats;
    drops: DropItem[];
    spoil: DropItem[];
}

interface NpcStats {
    str: number;
    con: number;
    dex: number;
    int: number;
    wit: number;
    men: number;
    hp: number;
    mp: number;
    hpRegen: number;
    mpRegen: number;
    pAtk: number;
    pDef: number;
    mAtk: number;
    mDef: number;
    atkSpeed: number;
    castSpeed: number;
    speed: number;
}

interface DropItem {
    itemId: number;
    min: number;
    max: number;
    chance: number;
}

// ============ Skills ============
export interface Skill {
    id: number;
    name: string;
    maxLevel: number;
    type: 'ACTIVE' | 'PASSIVE' | 'TOGGLE' | 'CHANCE';
    isPassive: boolean;
    target: string;
    effects: SkillEffect[];
}

interface SkillEffect {
    type: string;
    value: number;
}

// ============ Skill Trees ============
export interface SkillTree {
    [className: string]: ClassSkill[];
}

interface ClassSkill {
    id: number;
    name: string;
    minLevel: number;
    cost: number;
}

// ============ Class Templates ============
export interface ClassTemplate {
    stats: Record<string, number>;
    items: TemplateItem[];
    skills: TemplateSkill[];
}

interface TemplateItem {
    id: number;
    count: number;
}

interface TemplateSkill {
    id: number;
    level: number;
}

export interface ClassTemplates {
    [className: string]: ClassTemplate;
}

// ============ Pets ============
export interface Pet {
    id: number;
    name: string;
    level: number;
    exp: number;
    maxExp: number;
    hp: number;
    mp: number;
    pAtk: number;
    pDef: number;
    mAtk: number;
    mDef: number;
    atkSpeed: number;
    castSpeed: number;
    speed: number;
    foodId: number | null;
}

// ============ Fishing ============
export interface FishingData {
    fishes: Fish[];
    monsters: FishingMonster[];
    rods: FishingRod[];
}

interface Fish {
    id: number;
    name: string;
    level: number;
    hp: number;
    xp: number;
    sp: number;
}

interface FishingMonster {
    id: number;
    name: string;
    level: number;
}

interface FishingRod {
    id: number;
    name: string;
    mpConsume: number;
}

// ============ Henna ============
export interface Henna {
    symbolId: number;
    dyeId: number;
    name: string;
    stat: string;
    amount: number;
    price: number;
    INT: number;
    STR: number;
    CON: number;
    MEN: number;
    DEX: number;
    WIT: number;
}

// ============ Augmentation ============
export interface AugmentationData {
    skillMap: Record<string, AugSkill>;
    options: AugOption[];
}

interface AugSkill {
    skillId: number;
    skillLevel: number;
}

interface AugOption {
    id: number;
    effect1: string | null;
    effect2: string | null;
    effect3: string | null;
}
