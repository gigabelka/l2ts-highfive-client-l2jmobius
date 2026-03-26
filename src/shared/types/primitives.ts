/**
 * @fileoverview Примитивные типы для L2 протокола
 * @module shared/types/primitives
 */

/** ID объекта в игре (uint32) */
export type ObjectId = number;

/** ID предмета */
export type ItemId = number;

/** ID скила */
export type SkillId = number;

/** ID NPC */
export type NpcId = number;

/** Координаты в игровом мире */
export type Coordinate = number;

/** Уровень персонажа/NPC (1-85) */
export type Level = number;

/** Опкод пакета (uint8) */
export type Opcode = number;

/** Сессионный ключ */
export type SessionKey = Buffer;

/** Timestamp в миллисекундах */
export type Timestamp = number;

/** Уникальный идентификатор */
export type UniqueId = string;
