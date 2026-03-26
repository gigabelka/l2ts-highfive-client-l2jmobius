/**
 * @fileoverview Тесты для PacketSerializer
 * @module tests/performance/PacketSerializer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PacketSerializer } from '../../src/infrastructure/network/PacketSerializer';
import { BufferPool } from '../../src/infrastructure/network/BufferPool';

// Mock packet for testing - simple interface instead of extending class
interface MockPacket {
    encode(): Buffer;
}

class TestPacket implements MockPacket {
    readonly opcode = 0x01;

    constructor(private data: Buffer) {}

    encode(): Buffer {
        return this.data;
    }
}

describe('PacketSerializer', () => {
    let pool: BufferPool;
    let serializer: PacketSerializer;

    beforeEach(() => {
        pool = new BufferPool(10);
        serializer = new PacketSerializer(pool);
    });

    describe('serializeWithHeader', () => {
        it('should serialize packet with length header', () => {
            const packet = new TestPacket(Buffer.from([0x01, 0x02, 0x03]));
            const { buffer, cleanup } = serializer.serializeWithHeader(packet as any);

            expect(buffer.length).toBe(5); // 3 bytes data + 2 bytes header
            expect(buffer.readUInt16LE(0)).toBe(5); // Length includes header
            expect(buffer[2]).toBe(0x01);
            expect(buffer[3]).toBe(0x02);
            expect(buffer[4]).toBe(0x03);

            cleanup();
        });

        it('should return cleanup function', () => {
            const packet = new TestPacket(Buffer.from([0x01]));
            const { cleanup } = serializer.serializeWithHeader(packet as any);

            expect(typeof cleanup).toBe('function');
            cleanup();
        });
    });

    describe('serializeRawWithHeader', () => {
        it('should serialize raw data with length header', () => {
            const data = Buffer.from([0xAA, 0xBB, 0xCC]);
            const { buffer, cleanup } = serializer.serializeRawWithHeader(data);

            expect(buffer.length).toBe(5);
            expect(buffer.readUInt16LE(0)).toBe(5);
            expect(buffer[2]).toBe(0xAA);
            expect(buffer[3]).toBe(0xBB);
            expect(buffer[4]).toBe(0xCC);

            cleanup();
        });
    });

    describe('serializeBatch', () => {
        it('should serialize multiple packets', () => {
            const packets = [
                new TestPacket(Buffer.from([0x01])),
                new TestPacket(Buffer.from([0x02, 0x03])),
            ];

            const { buffer, cleanup } = serializer.serializeBatch(packets);

            // Total: 2 (batch header) + 3 (first: 2 header + 1 data) + 4 (second: 2 header + 2 data) = 9
            expect(buffer.length).toBe(9);
            expect(buffer.readUInt16LE(0)).toBe(9);

            cleanup();
        });
    });

    describe('Buffer Pooling', () => {
        it('should reuse buffers', () => {
            const packet = new TestPacket(Buffer.from([0x01]));

            // First serialization
            const { buffer: buf1, cleanup: cleanup1 } = serializer.serializeWithHeader(packet as any);
            cleanup1();

            // Second serialization should reuse
            const { buffer: buf2, cleanup: cleanup2 } = serializer.serializeWithHeader(packet as any);
            cleanup2();

            const stats = serializer.getPoolStats();
            expect(stats.reused).toBe(1);
        });

        it('should track pool stats', () => {
            const packet = new TestPacket(Buffer.from([0x01, 0x02, 0x03]));

            const { cleanup } = serializer.serializeWithHeader(packet as any);
            cleanup();

            const stats = serializer.getPoolStats();
            expect(stats.allocated).toBeGreaterThan(0);
        });
    });

    describe('preallocateCommonSizes', () => {
        it('should preallocate common buffer sizes', () => {
            serializer.preallocateCommonSizes();

            const stats = serializer.getPoolStats();
            expect(stats.allocated).toBeGreaterThan(0);
        });
    });
});
