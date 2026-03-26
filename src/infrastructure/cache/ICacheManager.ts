/**
 * @fileoverview Интерфейс менеджера кэша
 * @module infrastructure/cache/ICacheManager
 */

/**
 * Интерфейс для менеджера кэша с поддержкой TTL и статистики
 */
export interface ICacheManager {
    /**
     * Получить значение из кэша
     * @param key - Ключ кэша
     * @returns Значение или undefined если не найдено/истекло
     */
    get<T>(key: string): Promise<T | undefined>;

    /**
     * Установить значение в кэш
     * @param key - Ключ кэша
     * @param value - Значение для кэширования
     * @param ttlSeconds - Время жизни в секундах (опционально)
     */
    set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

    /**
     * Инвалидировать запись в кэше
     * @param key - Ключ кэша
     */
    invalidate(key: string): Promise<void>;

    /**
     * Очистить весь кэш
     */
    flush(): Promise<void>;

    /**
     * Получить статистику кэша
     * @returns Статистика: hits, misses, size
     */
    getStats(): { hits: number; misses: number; size: number };
}
