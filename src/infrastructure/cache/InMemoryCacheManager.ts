/**
 * @fileoverview In-memory реализация менеджера кэша
 * @module infrastructure/cache/InMemoryCacheManager
 */

import { ICacheManager } from './ICacheManager';

/**
 * Запись в кэше с метаданными
 */
interface CacheEntry<T> {
    value: T;
    expiresAt?: number;
    accessCount: number;
    lastAccessed: number;
}

/**
 * In-memory реализация менеджера кэша с TTL и статистикой
 */
export class InMemoryCacheManager implements ICacheManager {
    private cache = new Map<string, CacheEntry<unknown>>();
    private stats = { hits: 0, misses: 0 };
    private cleanupTimer?: ReturnType<typeof setInterval>;

    constructor() {
        // Cleanup expired entries every 5 minutes
        this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }

    async get<T>(key: string): Promise<T | undefined> {
        const entry = this.cache.get(key) as CacheEntry<T> | undefined;

        if (!entry) {
            this.stats.misses++;
            return undefined;
        }

        // Check expiration
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.stats.misses++;
            return undefined;
        }

        // Update access stats
        entry.accessCount++;
        entry.lastAccessed = Date.now();
        this.stats.hits++;

        return entry.value;
    }

    async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
        const expiresAt = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : undefined;

        this.cache.set(key, {
            value,
            expiresAt,
            accessCount: 0,
            lastAccessed: Date.now()
        });
    }

    async invalidate(key: string): Promise<void> {
        this.cache.delete(key);
    }

    async flush(): Promise<void> {
        this.cache.clear();
        this.stats = { hits: 0, misses: 0 };
    }

    getStats() {
        return {
            ...this.stats,
            size: this.cache.size
        };
    }

    /**
     * Получить расширенную статистику кэша
     */
    getDetailedStats() {
        const entries = Array.from(this.cache.entries());
        const now = Date.now();

        return {
            ...this.stats,
            size: this.cache.size,
            hitRatio: this.getHitRatio(),
            entries: entries.map(([key, entry]) => ({
                key,
                accessCount: entry.accessCount,
                lastAccessed: entry.lastAccessed,
                expiresIn: entry.expiresAt ? Math.max(0, entry.expiresAt - now) : undefined,
                isExpired: entry.expiresAt ? now > entry.expiresAt : false
            }))
        };
    }

    /**
     * Получить коэффициент попаданий в кэш (0-1)
     */
    getHitRatio(): number {
        const total = this.stats.hits + this.stats.misses;
        return total > 0 ? this.stats.hits / total : 0;
    }

    /**
     * Очистка истекших записей
     */
    private cleanup(): void {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiresAt && now > entry.expiresAt) {
                this.cache.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            // console.log(`[CacheManager] Cleaned ${cleaned} expired entries`);
        }
    }

    /**
     * Освобождение ресурсов
     */
    dispose(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
        }
        this.flush();
    }
}
