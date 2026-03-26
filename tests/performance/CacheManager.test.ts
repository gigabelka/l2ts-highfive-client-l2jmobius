/**
 * @fileoverview Тесты для InMemoryCacheManager
 * @module tests/performance/CacheManager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InMemoryCacheManager } from '../../src/infrastructure/cache/InMemoryCacheManager';

describe('InMemoryCacheManager', () => {
    let cache: InMemoryCacheManager;

    beforeEach(() => {
        cache = new InMemoryCacheManager();
    });

    afterEach(() => {
        cache.dispose();
    });

    describe('Basic Operations', () => {
        it('should store and retrieve values', async () => {
            await cache.set('key1', 'value1');
            const value = await cache.get('key1');
            expect(value).toBe('value1');
        });

        it('should return undefined for non-existent keys', async () => {
            const value = await cache.get('non-existent');
            expect(value).toBeUndefined();
        });

        it('should return undefined for invalidated keys', async () => {
            await cache.set('key1', 'value1');
            await cache.invalidate('key1');
            const value = await cache.get('key1');
            expect(value).toBeUndefined();
        });

        it('should clear all values on flush', async () => {
            await cache.set('key1', 'value1');
            await cache.set('key2', 'value2');
            await cache.flush();

            expect(await cache.get('key1')).toBeUndefined();
            expect(await cache.get('key2')).toBeUndefined();
        });
    });

    describe('TTL (Time To Live)', () => {
        it('should expire entries after TTL', async () => {
            await cache.set('key1', 'value1', 0.1); // 100ms TTL

            expect(await cache.get('key1')).toBe('value1');

            // Wait for expiration
            await new Promise(resolve => setTimeout(resolve, 150));

            expect(await cache.get('key1')).toBeUndefined();
        });

        it('should not expire entries without TTL', async () => {
            await cache.set('key1', 'value1');

            // Wait
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(await cache.get('key1')).toBe('value1');
        });
    });

    describe('Statistics', () => {
        it('should track hits and misses', async () => {
            await cache.set('key1', 'value1');

            // Hit
            await cache.get('key1');

            // Miss
            await cache.get('key2');

            const stats = cache.getStats();
            expect(stats.hits).toBe(1);
            expect(stats.misses).toBe(1);
            expect(stats.size).toBe(1);
        });

        it('should calculate hit ratio', async () => {
            await cache.set('key1', 'value1');

            // 3 hits
            await cache.get('key1');
            await cache.get('key1');
            await cache.get('key1');

            // 1 miss
            await cache.get('key2');

            const hitRatio = cache.getHitRatio();
            expect(hitRatio).toBe(0.75);
        });

        it('should track access count', async () => {
            await cache.set('key1', 'value1');

            await cache.get('key1');
            await cache.get('key1');
            await cache.get('key1');

            const detailedStats = cache.getDetailedStats();
            const entry = detailedStats.entries.find(e => e.key === 'key1');
            expect(entry?.accessCount).toBe(3);
        });
    });

    describe('Complex Data Types', () => {
        it('should cache objects', async () => {
            const obj = { id: 1, name: 'Test', nested: { value: 42 } };
            await cache.set('obj', obj);

            const cached = await cache.get<typeof obj>('obj');
            expect(cached).toEqual(obj);
        });

        it('should cache arrays', async () => {
            const arr = [1, 2, 3, { test: 'value' }];
            await cache.set('arr', arr);

            const cached = await cache.get<typeof arr>('arr');
            expect(cached).toEqual(arr);
        });
    });

    describe('Cleanup', () => {
        it('should cleanup expired entries on get', async () => {
            await cache.set('key1', 'value1', 0.05); // 50ms TTL
            await cache.set('key2', 'value2'); // No TTL

            // Wait for expiration
            await new Promise(resolve => setTimeout(resolve, 100));

            // Access expired key triggers cleanup
            await cache.get('key1');

            const stats = cache.getStats();
            expect(stats.size).toBe(1); // Only key2 remains
            expect(stats.misses).toBe(1); // key1 was a miss (expired)
        });
    });
});
