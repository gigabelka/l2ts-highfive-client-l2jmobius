/**
 * @fileoverview Example usage of GameSession class
 *
 * Run with: npx ts-node examples/GameSession-example.ts
 */

import { GameSession, createGameSession, PacketResult } from '../src/network/GameSession';
import { PacketHandler } from '../src/packets/PacketHandler';
import { BinaryReader } from '../src/network/BinaryReader';
import { InboundPacket } from '../src/packets/InboundPacket';

// ============================================================================
// Example 1: Simple packet handler registration
// ============================================================================

/**
 * Example packet class for testing
 */
class TestPacket extends InboundPacket {
    private opcode: number = 0;
    private data: number[] = [];

    parse(): void {
        const reader = new BinaryReader(this.getBuffer());
        this.opcode = reader.readC();
        // Read remaining bytes as data
        while (reader.getPosition() < this.getBuffer().length) {
            this.data.push(reader.readC());
        }
    }

    toJSON() {
        return {
            type: 'TestPacket',
            opcode: this.opcode,
            opcodeHex: `0x${this.opcode.toString(16).padStart(2, '0')}`,
            dataLength: this.data.length,
            data: this.data.map(b => `0x${b.toString(16).padStart(2, '0')}`)
        };
    }
}

// Register test packet for opcode 0x01
PacketHandler.register(0x01, TestPacket as any);

// ============================================================================
// Example 2: Basic GameSession usage
// ============================================================================

function exampleBasic() {
    console.log('=== Example: Basic GameSession ===\n');

    const session = createGameSession({
        debug: true,
        onConnect: () => {
            console.log('[Callback] Connected!');
        },
        onClose: (hadError) => {
            console.log(`[Callback] Closed ${hadError ? 'with error' : 'cleanly'}`);
        },
        onError: (err) => {
            console.log(`[Callback] Error: ${err.message}`);
        },
        onPacketArrival: (result: PacketResult) => {
            if (result.success) {
                console.log('[Callback] Packet arrived:', result.packet.toJSON());
            } else {
                console.log('[Callback] Failed to parse packet:', result.error);
            }
        }
    });

    // Simulate receiving data (normally this comes from server)
    // Create a test packet: length (2 bytes) + opcode (1 byte) + data
    const testPacket = Buffer.from([
        0x06, 0x00,  // Length = 6 bytes (including header)
        0x01,        // Opcode = 0x01
        0xAB, 0xCD, 0xEF  // Data bytes
    ]);

    console.log('Simulating packet arrival...');
    console.log('Raw bytes:', testPacket.toString('hex').match(/.{2}/g)?.join(' '));

    // Simulate data event
    session.emit('data', testPacket);

    session.disconnect();
}

// ============================================================================
// Example 3: Fragmented packet handling
// ============================================================================

function exampleFragmented() {
    console.log('\n=== Example: Fragmented Packets ===\n');

    const session = createGameSession({
        debug: true,
        onPacketArrival: (result) => {
            if (result.success) {
                console.log('[Fragmented] Received:', result.packet.toJSON());
            }
        }
    });

    // Create a larger test packet
    const largePacket = Buffer.from([
        0x0A, 0x00,  // Length = 10 bytes
        0x01,        // Opcode = 0x01
        0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77  // 7 data bytes
    ]);

    console.log('Sending first chunk (5 bytes)...');
    session.emit('data', largePacket.subarray(0, 5));

    console.log('\nSending second chunk (3 bytes)...');
    session.emit('data', largePacket.subarray(5, 8));

    console.log('\nSending final chunk (2 bytes)...');
    session.emit('data', largePacket.subarray(8));

    session.disconnect();
}

// ============================================================================
// Example 4: Multiple packets in single chunk
// ============================================================================

function exampleMultiplePackets() {
    console.log('\n=== Example: Multiple Packets in One Chunk ===\n');

    const session = createGameSession({
        debug: true,
        onPacketArrival: (result) => {
            if (result.success) {
                console.log('[Multi] Received:', result.packet.toJSON());
            }
        }
    });

    // Create two packets
    const packet1 = Buffer.from([
        0x05, 0x00,  // Length = 5
        0x01,        // Opcode
        0xAA, 0xBB   // Data
    ]);

    const packet2 = Buffer.from([
        0x04, 0x00,  // Length = 4
        0x01,        // Opcode
        0xCC         // Data
    ]);

    // Combine them
    const combined = Buffer.concat([packet1, packet2]);

    console.log('Sending combined chunk with 2 packets...');
    console.log('Raw bytes:', combined.toString('hex').match(/.{2}/g)?.join(' '));

    session.emit('data', combined);

    session.disconnect();
}

// ============================================================================
// Example 5: Connect to real server (commented out for safety)
// ============================================================================

function exampleRealConnection() {
    console.log('\n=== Example: Real Connection (disabled) ===\n');
    console.log('To connect to a real server, uncomment and configure:');
    console.log(`
    const session = createGameSession({
        debug: true,
        onPacketArrival: (result) => {
            console.log('Packet:', result);
        }
    });

    session.connectTo('127.0.0.1', 7777);
    `);
}

// ============================================================================
// Run examples
// ============================================================================

if (require.main === module) {
    exampleBasic();
    exampleFragmented();
    exampleMultiplePackets();
    exampleRealConnection();
}

export { exampleBasic, exampleFragmented, exampleMultiplePackets, exampleRealConnection };
