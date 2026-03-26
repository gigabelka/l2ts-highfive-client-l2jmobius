/**
 * @fileoverview Game Entity Types - TypeScript интерфейсы для модели игрового мира
 * @module game/entities
 * 
 * Эти интерфейсы используются для API и WebSocket ответов.
 * Они представляют "плоские" данные, полученные из игровых пакетов.
 */

// =============================================================================
// Клан и Альянс
// =============================================================================

/** Информация о клане */
export interface ClanInfo {
    id: number;
    name: string;
}

/** Информация об альянсе */
export interface AllyInfo {
    id: number;
    name: string;
}

// =============================================================================
// Экипировка
// =============================================================================

/** Предмет экипировки */
export interface EquipmentItem {
    itemId: number;
    name: string;
}

/** Экипировка персонажа (ключ - слот, значение - предмет) */
export type Equipment = Record<string, EquipmentItem>;

// =============================================================================
// 1. CharacterMe - мой персонаж (из пакета UserInfo 0x04)
// =============================================================================

export interface CharacterMe {
    // Идентификация
    objectId: number;
    name: string;
    title: string;

    // Класс и уровень
    classId: number;
    className: string;
    level: number;

    // Позиция
    x: number;
    y: number;
    z: number;
    heading: number;

    // Жизненные показатели
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
    cp: number;
    maxCp: number;

    // Опыт и SP
    exp: number;
    sp: number;

    // Базовые статы
    str: number;
    dex: number;
    con: number;
    int: number;
    wit: number;
    men: number;

    // Боевые статы
    pAtk: number;
    mAtk: number;
    pDef: number;
    mDef: number;

    // Скорости
    attackSpeed: number;
    castSpeed: number;
    runSpeed: number;
    walkSpeed: number;

    // PvP состояние
    pvpFlag: boolean;
    karma: number;

    // Состояния
    isRunning: boolean;
    isSitting: boolean;
    isInCombat: boolean;
    isDead: boolean;

    // Группы
    clan: ClanInfo | null;
    ally: AllyInfo | null;
}

// =============================================================================
// 2. Player - другой игрок (из CharInfo 0x03)
// =============================================================================

export interface Player {
    // Идентификация
    objectId: number;
    name: string;
    title: string;

    // Класс
    classId: number;
    className: string;

    // Позиция
    x: number;
    y: number;
    z: number;
    heading: number;

    // Состояния
    isRunning: boolean;
    isInCombat: boolean;
    isDead: boolean;
    pvpFlag: boolean;
    karma: number;

    // Группы и экипировка
    clan: ClanInfo | null;
    equipment: Equipment;

    // Расстояние до моего персонажа
    distanceToMe: number;
}

// =============================================================================
// 3. Npc - NPC/моб (из NpcInfo 0x16)
// =============================================================================

export interface Npc {
    // Идентификация
    objectId: number;
    npcId: number;
    name: string;
    title: string;

    // Позиция
    x: number;
    y: number;
    z: number;
    heading: number;

    // Состояния
    isAttackable: boolean;
    isDead: boolean;
    isRunning: boolean;

    // Скорости
    runSpeed: number;
    walkSpeed: number;

    // Расстояние до моего персонажа
    distanceToMe: number;
}

// =============================================================================
// 4. DroppedItem - предмет на земле (из SpawnItem/DropItem)
// =============================================================================

export interface DroppedItem {
    objectId: number;
    itemId: number;
    name: string;
    count: number;
    x: number;
    y: number;
    z: number;
    distanceToMe: number;
}

// =============================================================================
// 5. InventoryItem - предмет в инвентаре (из ItemList 0x1B)
// =============================================================================

export interface InventoryItem {
    objectId: number;
    itemId: number;
    name: string;
    count: number;
    isEquipped: boolean;
    enchantLevel: number;
    bodyPart: string;
    type: string;
}

// =============================================================================
// 6. Skill - навык персонажа
// =============================================================================

export interface Skill {
    id: number;
    name: string;
    level: number;
    isPassive: boolean;
    isToggle: boolean;
    isDisabled: boolean;
    cooldownRemaining: number; // в миллисекундах
}

// =============================================================================
// 7. PartyMember - член группы
// =============================================================================

export interface PartyMember {
    objectId: number;
    name: string;
    classId: number;
    className: string;
    level: number;

    // Жизненные показатели
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
    cp: number;
    maxCp: number;
}

// =============================================================================
// 8. ChatMessage - сообщение в чате
// =============================================================================

export type ChatMessageType =
    | 'all'
    | 'shout'
    | 'whisper'
    | 'party'
    | 'clan'
    | 'trade'
    | 'hero'
    | 'system';

export interface ChatMessage {
    timestamp: number;
    type: ChatMessageType;
    sender: string;
    message: string;
}

// =============================================================================
// 9. ActiveEffect - активный эффект (бафф/дебафф)
// =============================================================================

export interface ActiveEffect {
    skillId: number;
    skillName: string;
    level: number;
    remainingSeconds: number;
    isBuff: boolean;
}

// =============================================================================
// 10. TargetInfo - информация о цели
// =============================================================================

export type TargetType = 'player' | 'npc' | 'item';

export interface TargetInfo {
    objectId: number;
    name: string;
    type: TargetType;
    hp: number;
    maxHp: number;
}

// =============================================================================
// 11. WsEvent - обёртка WS-сообщения
// =============================================================================

export interface WsEvent<T = unknown> {
    type: string;
    ts: number;
    data: T;
}
