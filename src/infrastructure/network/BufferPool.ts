/**
 * @fileoverview Пул буферов для оптимизации памяти при сериализации пакетов
 * @module infrastructure/network/BufferPool
 */

/**
 * Статистика использования пула буферов
 */
export interface BufferPoolStats {
    /** Общее количество созданных буферов */
    allocated: number;
    /** Количество переиспользованных буферов */
    reused: number;
    /** Коэффициент переиспользования (0-1) */
    reuseRatio: number;
    /** Размеры пулов по категориям */
    poolSizes: Array<{ size: number; count: number }>;
}

/**
 * Пул буферов для переиспользования при сериализации пакетов
 * Снижает нагрузку на GC путем переиспользования выделенной памяти
 */
export class BufferPool {
    private pools = new Map<number, Buffer[]>(); // size -> buffer[]
    private maxPoolSize: number;
    private stats = { allocated: 0, reused: 0 };

    /**
     * @param maxPoolSize - Максимальное количество буферов в одном пуле
     */
    constructor(maxPoolSize: number = 20) {
        this.maxPoolSize = maxPoolSize;
    }

    /**
     * Получить буфер из пула или создать новый
     * @param size - Требуемый размер буфера
     * @returns Буфер нужного размера
     */
    acquire(size: number): Buffer {
        const poolSize = this.getPoolSize(size);
        const pool = this.pools.get(poolSize);

        if (pool && pool.length > 0) {
            const buffer = pool.pop()!;
            // Reset buffer content (zero fill for security)
            buffer.fill(0);
            this.stats.reused++;
            return buffer;
        }

        this.stats.allocated++;
        const newBuffer = Buffer.allocUnsafe(poolSize);
        newBuffer.fill(0);
        return newBuffer;
    }

    /**
     * Вернуть буфер в пул для переиспользования
     * @param buffer - Буфер для возврата в пул
     */
    release(buffer: Buffer): void {
        const poolSize = this.getPoolSize(buffer.length);
        let pool = this.pools.get(poolSize);

        if (!pool) {
            pool = [];
            this.pools.set(poolSize, pool);
        }

        if (pool.length < this.maxPoolSize) {
            pool.push(buffer);
        }
    }

    /**
     * Предварительно заполнить пул буферами определенного размера
     * @param size - Размер буфера
     * @param count - Количество буферов
     */
    preallocate(size: number, count: number): void {
        const poolSize = this.getPoolSize(size);
        let pool = this.pools.get(poolSize);

        if (!pool) {
            pool = [];
            this.pools.set(poolSize, pool);
        }

        const toAllocate = Math.min(count, this.maxPoolSize - pool.length);
        for (let i = 0; i < toAllocate; i++) {
            pool.push(Buffer.allocUnsafe(poolSize));
            this.stats.allocated++;
        }
    }

    /**
     * Получить статистику использования пула
     */
    getStats(): BufferPoolStats {
        const total = this.stats.allocated + this.stats.reused;
        return {
            ...this.stats,
            poolSizes: Array.from(this.pools.entries()).map(([size, buffers]) => ({
                size,
                count: buffers.length
            })),
            reuseRatio: total > 0 ? this.stats.reused / total : 0
        };
    }

    /**
     * Очистить все пулы
     */
    clear(): void {
        this.pools.clear();
        this.stats = { allocated: 0, reused: 0 };
    }

    /**
     * Округлить размер до ближайшей степени 2 для эффективного пулинга
     */
    private getPoolSize(size: number): number {
        // Minimum pool size is 32 bytes, then powers of 2
        return Math.max(32, Math.pow(2, Math.ceil(Math.log2(size))));
    }
}

/**
 * Глобальный singleton пула буферов для всего приложения
 */
export const globalBufferPool = new BufferPool(50);
