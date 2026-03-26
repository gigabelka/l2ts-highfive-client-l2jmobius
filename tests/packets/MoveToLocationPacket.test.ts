/**
 * @fileoverview Tests for MoveToLocationPacket
 */

import { describe, it, expect } from 'vitest';
import { PacketReader } from '../../src/network/PacketReader';
import { MoveToLocationPacket } from '../../src/infrastructure/protocol/game/packets/MoveToLocationPacket';

describe('MoveToLocationPacket', () => {
    it('should decode minimal packet (4 bytes - only objectId)', () => {
        // L2J Mobius sometimes sends only objectId (4 bytes)
        const buffer = Buffer.alloc(4);
        buffer.writeInt32LE(12345, 0);   // objectId

        const reader = new PacketReader(buffer);
        const packet = new MoveToLocationPacket().decode(reader);
        const data = packet.getData();

        expect(data.objectId).toBe(12345);
        expect(data.targetX).toBe(0);
        expect(data.targetY).toBe(0);
        expect(data.targetZ).toBe(0);
        expect(data.originX).toBe(0);
        expect(data.originY).toBe(0);
        expect(data.originZ).toBe(0);
        expect(data.moveSpeed).toBe(0);
    });

    it('should decode packet with objectId + targetX (8 bytes)', () => {
        const buffer = Buffer.alloc(8);
        buffer.writeInt32LE(12345, 0);   // objectId
        buffer.writeInt32LE(1000, 4);    // targetX

        const reader = new PacketReader(buffer);
        const packet = new MoveToLocationPacket().decode(reader);
        const data = packet.getData();

        expect(data.objectId).toBe(12345);
        expect(data.targetX).toBe(1000);
        expect(data.targetY).toBe(0);
        expect(data.targetZ).toBe(0);
        expect(data.originX).toBe(1000);
        expect(data.originY).toBe(0);
        expect(data.originZ).toBe(0);
        expect(data.moveSpeed).toBe(0);
    });

    it('should decode packet with target coordinates (16 bytes)', () => {
        // Create buffer: objectId (4) + targetX (4) + targetY (4) + targetZ (4) = 16 bytes
        const buffer = Buffer.alloc(16);
        buffer.writeInt32LE(12345, 0);   // objectId
        buffer.writeInt32LE(1000, 4);    // targetX
        buffer.writeInt32LE(2000, 8);    // targetY
        buffer.writeInt32LE(3000, 12);   // targetZ

        const reader = new PacketReader(buffer);
        const packet = new MoveToLocationPacket().decode(reader);
        const data = packet.getData();

        expect(data.objectId).toBe(12345);
        expect(data.targetX).toBe(1000);
        expect(data.targetY).toBe(2000);
        expect(data.targetZ).toBe(3000);
        // When origin is not provided, it defaults to target
        expect(data.originX).toBe(1000);
        expect(data.originY).toBe(2000);
        expect(data.originZ).toBe(3000);
        expect(data.moveSpeed).toBe(0);
    });

    it('should decode full packet (28 bytes - with origin coordinates)', () => {
        // Create buffer: objectId (4) + targetX/Y/Z (12) + originX/Y/Z (12) = 28 bytes
        const buffer = Buffer.alloc(28);
        buffer.writeInt32LE(12345, 0);   // objectId
        buffer.writeInt32LE(1000, 4);    // targetX
        buffer.writeInt32LE(2000, 8);    // targetY
        buffer.writeInt32LE(3000, 12);   // targetZ
        buffer.writeInt32LE(500, 16);    // originX
        buffer.writeInt32LE(600, 20);    // originY
        buffer.writeInt32LE(700, 24);    // originZ

        const reader = new PacketReader(buffer);
        const packet = new MoveToLocationPacket().decode(reader);
        const data = packet.getData();

        expect(data.objectId).toBe(12345);
        expect(data.targetX).toBe(1000);
        expect(data.targetY).toBe(2000);
        expect(data.targetZ).toBe(3000);
        expect(data.originX).toBe(500);
        expect(data.originY).toBe(600);
        expect(data.originZ).toBe(700);
        expect(data.moveSpeed).toBe(0);
    });

    it('should decode packet with move speed (32 bytes)', () => {
        // Create buffer: objectId (4) + targetX/Y/Z (12) + originX/Y/Z (12) + moveSpeed (4) = 32 bytes
        const buffer = Buffer.alloc(32);
        buffer.writeInt32LE(12345, 0);   // objectId
        buffer.writeInt32LE(1000, 4);    // targetX
        buffer.writeInt32LE(2000, 8);    // targetY
        buffer.writeInt32LE(3000, 12);   // targetZ
        buffer.writeInt32LE(500, 16);    // originX
        buffer.writeInt32LE(600, 20);    // originY
        buffer.writeInt32LE(700, 24);    // originZ
        buffer.writeInt32LE(120, 28);    // moveSpeed

        const reader = new PacketReader(buffer);
        const packet = new MoveToLocationPacket().decode(reader);
        const data = packet.getData();

        expect(data.objectId).toBe(12345);
        expect(data.targetX).toBe(1000);
        expect(data.targetY).toBe(2000);
        expect(data.targetZ).toBe(3000);
        expect(data.originX).toBe(500);
        expect(data.originY).toBe(600);
        expect(data.originZ).toBe(700);
        expect(data.moveSpeed).toBe(120);
    });

    it('should calculate distance correctly', () => {
        const buffer = Buffer.alloc(28);
        buffer.writeInt32LE(12345, 0);   // objectId
        buffer.writeInt32LE(1000, 4);    // targetX
        buffer.writeInt32LE(2000, 8);    // targetY
        buffer.writeInt32LE(3000, 12);   // targetZ
        buffer.writeInt32LE(0, 16);      // originX
        buffer.writeInt32LE(0, 20);      // originY
        buffer.writeInt32LE(0, 24);      // originZ

        const reader = new PacketReader(buffer);
        const packet = new MoveToLocationPacket().decode(reader);
        
        const distance = packet.getDistance();
        // Distance from (0,0,0) to (1000,2000,3000)
        const expected = Math.sqrt(1000*1000 + 2000*2000 + 3000*3000);
        expect(distance).toBeCloseTo(expected, 5);
    });
});
