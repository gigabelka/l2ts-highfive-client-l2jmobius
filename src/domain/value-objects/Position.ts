/**
 * @fileoverview Position - Value Object для 3D позиции в игровом мире
 * Неизменяемый, с методами для вычислений
 * @module domain/value-objects
 */

import { Result } from '../../shared/result';

export interface PositionData {
    x: number;
    y: number;
    z: number;
    heading?: number;
}

/**
 * Value Object для позиции в игровом мире
 * Неизменяемый - любая модификация создает новый объект
 */
export class Position {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly heading: number;

    constructor(data: PositionData) {
        this.x = data.x;
        this.y = data.y;
        this.z = data.z;
        this.heading = data.heading ?? 0;
    }

    /**
     * Factory method с валидацией
     */
    static create(data: PositionData): Result<Position, PositionError> {
        if (!Number.isFinite(data.x) || !Number.isFinite(data.y) || !Number.isFinite(data.z)) {
            return Result.err(new PositionError('Coordinates must be finite numbers'));
        }
        return Result.ok(new Position(data));
    }

    /**
     * Создать из координат
     */
    static at(x: number, y: number, z: number, heading?: number): Position {
        return new Position({ x, y, z, heading });
    }

    /**
     * Нулевая позиция (начало координат)
     */
    static zero(): Position {
        return new Position({ x: 0, y: 0, z: 0 });
    }

    /**
     * Расстояние до другой позиции (3D)
     */
    distanceTo(other: Position): number {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const dz = this.z - other.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Расстояние до другой позиции (2D, без учета Z)
     */
    distanceTo2D(other: Position): number {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Проверить, находится ли позиция в радиусе
     */
    isInRange(other: Position, radius: number): boolean {
        return this.distanceTo(other) <= radius;
    }

    /**
     * Создать новую позицию со смещением
     */
    translate(dx: number, dy: number, dz: number): Position {
        return new Position({
            x: this.x + dx,
            y: this.y + dy,
            z: this.z + dz,
            heading: this.heading
        });
    }

    /**
     * Создать новую позицию с новым heading
     */
    withHeading(heading: number): Position {
        return new Position({
            x: this.x,
            y: this.y,
            z: this.z,
            heading
        });
    }

    /**
     * Проверить равенство
     */
    equals(other: Position, tolerance: number = 0): boolean {
        if (tolerance === 0) {
            return this.x === other.x && this.y === other.y && this.z === other.z;
        }
        return this.distanceTo(other) <= tolerance;
    }

    /**
     * Клонировать
     */
    clone(): Position {
        return new Position({
            x: this.x,
            y: this.y,
            z: this.z,
            heading: this.heading
        });
    }

    /**
     * Преобразовать в plain object
     */
    toJSON(): PositionData {
        return {
            x: this.x,
            y: this.y,
            z: this.z,
            heading: this.heading
        };
    }

    /**
     * Строковое представление
     */
    toString(): string {
        return `Position(${this.x.toFixed(0)}, ${this.y.toFixed(0)}, ${this.z.toFixed(0)})`;
    }
}

export class PositionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PositionError';
    }
}
