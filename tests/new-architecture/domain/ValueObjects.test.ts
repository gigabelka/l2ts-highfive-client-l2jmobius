import { describe, it, expect } from 'vitest';
import {
    Position,
    Vitals,
    Experience,
    ObjectId,
    BaseStats,
    CombatStats,
} from '../../../src/domain/value-objects';

describe('Value Objects', () => {
    describe('Position', () => {
        it('should create position with factory', () => {
            const pos = Position.create({ x: 100, y: 200, z: 50 });
            expect(pos.isOk()).toBe(true);
            expect(pos.getOrThrow().x).toBe(100);
        });

        it('should reject invalid coordinates', () => {
            const pos = Position.create({ x: NaN, y: 0, z: 0 });
            expect(pos.isErr()).toBe(true);
        });

        it('should calculate distance between positions', () => {
            const pos1 = Position.at(0, 0, 0);
            const pos2 = Position.at(3, 4, 0);
            expect(pos1.distanceTo(pos2)).toBe(5);
        });

        it('should check if position is in range', () => {
            const pos1 = Position.at(0, 0, 0);
            const pos2 = Position.at(100, 0, 0);
            expect(pos1.isInRange(pos2, 150)).toBe(true);
            expect(pos1.isInRange(pos2, 50)).toBe(false);
        });

        it('should be immutable', () => {
            const pos = Position.at(10, 20, 30);
            const translated = pos.translate(5, 5, 5);
            expect(pos.x).toBe(10);
            expect(translated.x).toBe(15);
        });
    });

    describe('Vitals', () => {
        it('should enforce constraints', () => {
            const vitals = Vitals.create({ current: 150, max: 100 });
            expect(vitals.isOk()).toBe(true);
            expect(vitals.getOrThrow().current).toBe(100); // Clamped to max
        });

        it('should calculate percentage', () => {
            const vitals = new Vitals({ current: 50, max: 200 });
            expect(vitals.percent).toBe(25);
        });

        it('should detect empty and full states', () => {
            const empty = Vitals.zero();
            const full = Vitals.full(100);
            expect(empty.isEmpty).toBe(true);
            expect(full.isFull).toBe(true);
        });
    });

    describe('Experience', () => {
        it('should calculate level progress', () => {
            const exp = Experience.create(1, 34, 0);
            expect(exp.levelProgressPercent).toBe(50); // 34/68 = 50%
        });

        it('should determine if can level up', () => {
            const exp = Experience.create(1, 68, 0);
            expect(exp.canLevelUp).toBe(true);
        });

        it('should calculate exp needed for next level', () => {
            const exp = Experience.create(1, 0, 0);
            expect(exp.expForNextLevel).toBe(68);
            expect(exp.expNeededForLevel).toBe(68);
        });
    });

    describe('ObjectId', () => {
        it('should validate positive integers', () => {
            const id = ObjectId.create(12345);
            expect(id.isOk()).toBe(true);
            expect(id.getOrThrow().value).toBe(12345);
        });

        it('should reject invalid values', () => {
            expect(ObjectId.create(-1).isErr()).toBe(true);
            expect(ObjectId.create(0).isErr()).toBe(true);
            expect(ObjectId.create(1.5).isErr()).toBe(true);
        });

        it('should compare equality', () => {
            const id1 = ObjectId.of(100);
            const id2 = ObjectId.of(100);
            const id3 = ObjectId.of(200);
            expect(id1.equals(id2)).toBe(true);
            expect(id1.equals(id3)).toBe(false);
        });
    });

    describe('BaseStats', () => {
        it('should create with defaults for missing values', () => {
            const stats = BaseStats.create({ str: 20 });
            expect(stats.str).toBe(20);
            expect(stats.dex).toBe(1); // Default
        });

        it('should enforce minimum values', () => {
            const stats = BaseStats.create({ str: -5 });
            expect(stats.str).toBe(1);
        });
    });
});
