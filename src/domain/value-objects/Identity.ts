/**
 * @fileoverview Identity - Value Objects для идентификации сущностей
 * @module domain/value-objects
 */

import { Result } from '../../shared/result';

export interface ObjectIdData {
    value: number;
}

/**
 * Object ID - уникальный идентификатор игрового объекта
 */
export class ObjectId {
    readonly value: number;

    constructor(value: number) {
        this.value = value;
    }

    static create(value: number): Result<ObjectId, IdentityError> {
        if (!Number.isInteger(value) || value <= 0) {
            return Result.err(new IdentityError('ObjectId must be positive integer'));
        }
        return Result.ok(new ObjectId(value));
    }

    static of(value: number): ObjectId {
        return new ObjectId(value);
    }

    equals(other: ObjectId): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return `ObjectId(${this.value})`;
    }
}

export interface NpcTemplateIdData {
    value: number;
}

/**
 * Template ID NPC
 */
export class NpcTemplateId {
    readonly value: number;

    constructor(value: number) {
        this.value = value;
    }

    static create(value: number): Result<NpcTemplateId, IdentityError> {
        if (!Number.isInteger(value) || value <= 0) {
            return Result.err(new IdentityError('NpcTemplateId must be positive integer'));
        }
        return Result.ok(new NpcTemplateId(value));
    }

    equals(other: NpcTemplateId): boolean {
        return this.value === other.value;
    }
}

export interface ItemTemplateIdData {
    value: number;
}

/**
 * Template ID предмета
 */
export class ItemTemplateId {
    readonly value: number;

    constructor(value: number) {
        this.value = value;
    }

    static create(value: number): Result<ItemTemplateId, IdentityError> {
        if (!Number.isInteger(value) || value <= 0) {
            return Result.err(new IdentityError('ItemTemplateId must be positive integer'));
        }
        return Result.ok(new ItemTemplateId(value));
    }

    equals(other: ItemTemplateId): boolean {
        return this.value === other.value;
    }
}

export interface SkillIdData {
    value: number;
    level: number;
}

/**
 * Идентификатор скила (ID + уровень)
 */
export class SkillId {
    readonly value: number;
    readonly level: number;

    constructor(value: number, level: number) {
        this.value = value;
        this.level = level;
    }

    static create(value: number, level: number): Result<SkillId, IdentityError> {
        if (!Number.isInteger(value) || value <= 0) {
            return Result.err(new IdentityError('SkillId must be positive integer'));
        }
        if (!Number.isInteger(level) || level <= 0) {
            return Result.err(new IdentityError('Skill level must be positive integer'));
        }
        return Result.ok(new SkillId(value, level));
    }

    static of(value: number, level: number): SkillId {
        return new SkillId(value, level);
    }

    get key(): string {
        return `${this.value}-${this.level}`;
    }

    equals(other: SkillId): boolean {
        return this.value === other.value && this.level === other.level;
    }

    toString(): string {
        return `SkillId(${this.value}, Lv.${this.level})`;
    }
}

export class IdentityError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'IdentityError';
    }
}
