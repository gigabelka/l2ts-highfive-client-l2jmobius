/**
 * @fileoverview Сериализатор пакетов с использованием Buffer Pooling
 * @module infrastructure/network/PacketSerializer
 */

import { BufferPool, globalBufferPool } from './BufferPool';
import type { OutgoingGamePacket } from '../../game/packets/outgoing/OutgoingGamePacket';

/**
 * Результат сериализации с буфером и функцией очистки
 */
export interface SerializedPacket {
    /** Сериализованный буфер (с заголовком длины) */
    buffer: Buffer;
    /** Функция для возврата буфера в пул */
    cleanup: () => void;
}

/**
 * Сериализатор пакетов с использованием пула буферов
 * Снижает нагрузку на GC путем переиспользования памяти
 */
export class PacketSerializer {
    private bufferPool: BufferPool;

    /**
     * @param bufferPool - Пул буферов (используется глобальный по умолчанию)
     */
    constructor(bufferPool: BufferPool = globalBufferPool) {
        this.bufferPool = bufferPool;
    }

    /**
     * Сериализовать исходящий пакет с заголовком длины
     * @param packet - Пакет для сериализации
     * @returns Сериализованный буфер и функция очистки
     */
    serializeWithHeader(packet: OutgoingGamePacket): SerializedPacket {
        const body = packet.encode();
        return this.serializeRawWithHeader(body);
    }

    /**
     * Сериализовать сырые данные с заголовком длины
     * @param data - Данные для сериализации
     * @returns Сериализованный буфер и функция очистки
     */
    serializeRawWithHeader(data: Buffer): SerializedPacket {
        const totalSize = data.length + 2; // 2 bytes for length header
        const buffer = this.bufferPool.acquire(totalSize);

        buffer.writeUInt16LE(totalSize, 0);
        data.copy(buffer, 2);

        return {
            buffer: buffer.subarray(0, totalSize),
            cleanup: () => this.bufferPool.release(buffer)
        };
    }

    /**
     * Сериализовать несколько пакетов в один буфер (для батчинга)
     * @param packets - Массив пакетов
     * @returns Сериализованный буфер и функция очистки
     */
    serializeBatch(packets: OutgoingGamePacket[]): SerializedPacket {
        // Calculate total size
        const bodies = packets.map(p => p.encode());
        const totalBodySize = bodies.reduce((sum, body) => sum + body.length + 2, 0);
        const totalSize = totalBodySize + 2; // +2 for batch header

        const buffer = this.bufferPool.acquire(totalSize);
        let offset = 0;

        // Batch header (total length)
        buffer.writeUInt16LE(totalSize, offset);
        offset += 2;

        // Each packet with length header
        for (const body of bodies) {
            buffer.writeUInt16LE(body.length + 2, offset);
            offset += 2;
            body.copy(buffer, offset);
            offset += body.length;
        }

        return {
            buffer: buffer.subarray(0, offset),
            cleanup: () => this.bufferPool.release(buffer)
        };
    }

    /**
     * Получить статистику пула буферов
     */
    getPoolStats() {
        return this.bufferPool.getStats();
    }

    /**
     * Предварительно выделить буферы часто используемых размеров
     */
    preallocateCommonSizes(): void {
        // Preallocate for common packet sizes
        this.bufferPool.preallocate(64, 10);   // Small packets
        this.bufferPool.preallocate(128, 10);  // Medium packets
        this.bufferPool.preallocate(256, 5);   // Large packets
        this.bufferPool.preallocate(512, 3);   // Extra large packets
    }
}

/**
 * Глобальный singleton сериализатора
 */
export const globalPacketSerializer = new PacketSerializer(globalBufferPool);
