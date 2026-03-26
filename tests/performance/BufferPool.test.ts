/**
 * @fileoverview Тесты для BufferPool
 * @module tests/performance/BufferPool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BufferPool } from '../../src/infrastructure/network/BufferPool';

describe('BufferPool', () => {
    let pool: BufferPool;

    beforeEach(() => {
        pool = new BufferPool(10);
    });

    describe('Basic Operations', () => {
        it('should allocate new buffer when pool is empty', () => {
            const buffer = pool.acquire(64);
            expect(buffer.length).toBe(64);

            const stats = pool.getStats();
            expect(stats.allocated).toBe(1);
            expect(stats.reused).toBe(0);
        });

        it('should reuse released buffer', () => {
            const buffer1 = pool.acquire(64);
            pool.release(buffer1);

            const buffer2 = pool.acquire(64);
            // Buffer pool returns the same underlying buffer (but possibly different view)
            // We verify reuse through stats instead of reference equality

            const stats = pool.getStats();
            expect(stats.allocated).toBe(1);
            expect(stats.reused).toBe(1);
        });

        it('should zero-fill reused buffers', () => {
            const buffer = pool.acquire(32);
            buffer.fill(0xFF);
            pool.release(buffer);

            const reused = pool.acquire(32);
            expect(reused.every(b => b === 0)).toBe(true);
        });
    });

    describe('Pool Sizing', () => {
        it('should round up to power of 2', () => {
            // Size 50 should round up to 64 (next power of 2)
            const buffer1 = pool.acquire(50);
            pool.release(buffer1);

            // Size 60 should use same pool as 50
            const buffer2 = pool.acquire(60);
            expect(pool.getStats().reused).toBe(1);
            pool.release(buffer2);

            // Size 100 should round up to 128 (different pool)
            const buffer3 = pool.acquire(100);
            expect(pool.getStats().allocated).toBe(2);
        });

        it('should respect minimum pool size of 32', () => {
            const buffer = pool.acquire(10);
            pool.release(buffer);

            // Should be able to reuse for 20 bytes
            const reused = pool.acquire(20);
            expect(pool.getStats().reused).toBe(1);
        });
    });

    describe('Pool Limits', () => {
        it('should not exceed max pool size', () => {
            const buffers: Buffer[] = [];

            // Acquire and release more than max
            for (let i = 0; i < 15; i++) {
                const buf = pool.acquire(64);
                buffers.push(buf);
            }

            // Release all
            for (const buf of buffers) {
                pool.release(buf);
            }

            // Pool should only keep maxPoolSize (10)
            const stats = pool.getStats();
            expect(stats.poolSizes[0]?.count).toBeLessThanOrEqual(10);
        });
    });

    describe('Preallocation', () => {
        it('should preallocate buffers', () => {
            pool.preallocate(64, 5);

            const stats = pool.getStats();
            expect(stats.allocated).toBe(5);
            expect(stats.poolSizes[0]?.count).toBe(5);
        });

        it('should not exceed max pool size during preallocation', () => {
            pool.preallocate(64, 20);

            const stats = pool.getStats();
            expect(stats.allocated).toBe(10); // Limited by maxPoolSize
        });
    });

    describe('Statistics', () => {
        it('should track reuse ratio', () => {
            // First allocation
            const buf1 = pool.acquire(64);
            pool.release(buf1);

            // Second allocation should reuse
            const buf2 = pool.acquire(64);

            const stats = pool.getStats();
            expect(stats.reuseRatio).toBe(0.5); // 1 reused / 2 total
        });

        it('should report pool sizes', () => {
            const buf1 = pool.acquire(32);
            const buf2 = pool.acquire(64);
            const buf3 = pool.acquire(128);

            // Release to populate pools
            pool.release(buf1);
            pool.release(buf2);
            pool.release(buf3);

            const stats = pool.getStats();
            expect(stats.poolSizes).toHaveLength(3);
        });
    });

    describe('Clear', () => {
        it('should clear all pools', () => {
            const buf = pool.acquire(64);
            pool.release(buf);

            pool.clear();

            const stats = pool.getStats();
            expect(stats.poolSizes).toHaveLength(0);
            expect(stats.allocated).toBe(0);
            expect(stats.reused).toBe(0);
        });
    });
});
