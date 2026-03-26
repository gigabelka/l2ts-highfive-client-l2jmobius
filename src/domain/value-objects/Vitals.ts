/**
 * @fileoverview Vitals - Value Objects для HP, MP, CP
 * @module domain/value-objects
 */

import { Result } from '../../shared/result';

export interface VitalsData {
    current: number;
    max: number;
}

/**
 * Value Object для жизненных показателей (HP/MP/CP)
 * Гарантирует: 0 <= current <= max
 */
export class Vitals {
    readonly current: number;
    readonly max: number;

    constructor(data: VitalsData) {
        this.max = Math.max(0, Math.floor(data.max));
        this.current = Math.max(0, Math.min(Math.floor(data.current), this.max));
    }

    /**
     * Factory method с валидацией
     */
    static create(data: VitalsData): Result<Vitals, VitalsError> {
        if (!Number.isFinite(data.current) || !Number.isFinite(data.max)) {
            return Result.err(new VitalsError('Values must be finite numbers'));
        }
        if (data.max < 0) {
            return Result.err(new VitalsError('Max value cannot be negative'));
        }
        return Result.ok(new Vitals(data));
    }

    /**
     * Полные HP/MP/CP
     */
    static full(max: number): Vitals {
        return new Vitals({ current: max, max });
    }

    /**
     * Нулевые HP/MP/CP
     */
    static zero(): Vitals {
        return new Vitals({ current: 0, max: 0 });
    }

    /**
     * Процент текущего значения
     */
    get percent(): number {
        return this.max > 0 ? (this.current / this.max) * 100 : 0;
    }

    /**
     * Проверить, является ли "пустым" (0)
     */
    get isEmpty(): boolean {
        return this.current === 0;
    }

    /**
     * Проверить, является ли "полным"
     */
    get isFull(): boolean {
        return this.current === this.max;
    }

    /**
     * Изменить текущее значение
     */
    change(delta: number): Vitals {
        return new Vitals({
            current: this.current + delta,
            max: this.max
        });
    }

    /**
     * Восстановить до максимума
     */
    restore(): Vitals {
        return new Vitals({ current: this.max, max: this.max });
    }

    /**
     * Обнулить
     */
    deplete(): Vitals {
        return new Vitals({ current: 0, max: this.max });
    }

    /**
     * Изменить максимум
     */
    setMax(newMax: number): Vitals {
        return new Vitals({
            current: Math.min(this.current, newMax),
            max: newMax
        });
    }

    /**
     * Проверить равенство
     */
    equals(other: Vitals): boolean {
        return this.current === other.current && this.max === other.max;
    }

    /**
     * Разница между текущими значениями
     */
    delta(other: Vitals): number {
        return this.current - other.current;
    }

    toJSON(): VitalsData {
        return {
            current: this.current,
            max: this.max
        };
    }

    toString(): string {
        return `${this.current}/${this.max} (${this.percent.toFixed(1)}%)`;
    }
}

export class VitalsError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'VitalsError';
    }
}
