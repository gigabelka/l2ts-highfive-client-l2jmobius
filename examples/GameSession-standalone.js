/**
 * @fileoverview Standalone GameSession example
 * 
 * This file demonstrates GameSession class without TypeScript compilation.
 * It implements a simplified version directly in JavaScript.
 * 
 * Run with: node examples/GameSession-standalone.js
 */

const net = require('net');
const { EventEmitter } = require('events');

// ============================================================================
// Simplified PacketHandler for demonstration
// ============================================================================

class PacketHandler {
    static registry = new Map();

    static register(opcode, packetClass) {
        this.registry.set(opcode, packetClass);
    }

    static handle(buffer) {
        if (!buffer || buffer.length === 0) {
            return { success: false, opcode: -1, error: 'Empty buffer', hexDump: '' };
        }

        const opcode = buffer[0];
        const PacketClass = this.registry.get(opcode);

        if (!PacketClass) {
            return {
                success: false,
                opcode,
                error: `Unknown opcode: 0x${opcode.toString(16).padStart(2, '0')}`,
                hexDump: buffer.toString('hex')
            };
        }

        try {
            const packet = new PacketClass(buffer);
            packet.parse();
            return { success: true, opcode, packet };
        } catch (error) {
            return {
                success: false,
                opcode,
                error: error.message,
                hexDump: buffer.toString('hex')
            };
        }
    }
}

// ============================================================================
// Example Packet Classes
// ============================================================================

class BasePacket {
    constructor(buffer) {
        this.buffer = buffer;
        this.pos = 0;
    }

    readUInt8() {
        return this.buffer.readUInt8(this.pos++);
    }

    readUInt16LE() {
        const val = this.buffer.readUInt16LE(this.pos);
        this.pos += 2;
        return val;
    }

    skip(n) {
        this.pos += n;
    }

    remaining() {
        return this.buffer.length - this.pos;
    }
}

class LoginFailPacket extends BasePacket {
    parse() {
        this.skip(1); // Skip opcode
        this.reason = this.readUInt32LE ? this.readUInt32LE() : this.readUInt8();
    }

    toJSON() {
        return {
            type: 'LoginFail',
            reason: this.reason,
            reasonHex: `0x${this.reason?.toString(16) || '??'}`
        };
    }
}

class InitPacket extends BasePacket {
    parse() {
        this.skip(1); // Skip opcode
        this.sessionId = this.readUInt32LE ? this.readUInt32LE() : 
            (this.readUInt8() | (this.readUInt8() << 8) | (this.readUInt8() << 16) | (this.readUInt8() << 24));
        
        // Read protocol version (4 bytes)
        this.protocol = 0;
        for (let i = 0; i < 4 && this.remaining() > 0; i++) {
            this.protocol |= this.readUInt8() << (i * 8);
        }
        
        // Read RSA modulus (128 bytes)
        if (this.remaining() >= 128) {
            this.rsaModulus = this.buffer.subarray(this.pos, this.pos + 128);
            this.skip(128);
        }
    }

    toJSON() {
        return {
            type: 'Init',
            sessionId: this.sessionId,
            protocol: this.protocol,
            hasRsa: !!this.rsaModulus
        };
    }
}

// Register packets
PacketHandler.register(0x00, InitPacket);
PacketHandler.register(0x01, LoginFailPacket);

// ============================================================================
// GameSession Class
// ============================================================================

class GameSession extends net.Socket {
    constructor(options = {}) {
        super();
        this.recvBuffer = Buffer.alloc(0);
        this.options = options;
        this.isConnected = false;

        this.on('connect', this.handleConnect.bind(this));
        this.on('data', this.handleData.bind(this));
        this.on('close', this.handleClose.bind(this));
        this.on('error', this.handleError.bind(this));
    }

    connectTo(host, port) {
        this.log('debug', `Connecting to ${host}:${port}...`);
        this.connect(port, host);
        return this;
    }

    sendRaw(data) {
        if (this.destroyed || !this.writable) {
            this.log('error', 'Cannot send: socket not writable');
            return false;
        }
        this.log('debug', `Sending ${data.length} bytes`);
        return this.write(data);
    }

    sendPacket(body) {
        const packetLen = body.length + 2;
        const packet = Buffer.allocUnsafe(packetLen);
        packet.writeUInt16LE(packetLen, 0);
        body.copy(packet, 2);
        return this.sendRaw(packet);
    }

    disconnect() {
        this.log('debug', 'Disconnecting...');
        if (!this.destroyed) {
            this.end();
        }
    }

    get connected() {
        return this.isConnected;
    }

    handleConnect() {
        this.isConnected = true;
        this.log('info', 'Connected successfully');
        this.options.onConnect?.();
    }

    handleData(chunk) {
        this.log('debug', `Received ${chunk.length} bytes from TCP`);

        // Accumulate data
        this.recvBuffer = Buffer.concat([this.recvBuffer, chunk]);

        // Process complete packets
        while (this.recvBuffer.length >= 2) {
            const packetLen = this.recvBuffer.readUInt16LE(0);

            if (packetLen < 2) {
                this.log('error', `Invalid packet length: ${packetLen}`);
                this.recvBuffer = this.recvBuffer.subarray(2);
                continue;
            }

            if (this.recvBuffer.length < packetLen) {
                this.log('debug', `Incomplete packet: need ${packetLen}, have ${this.recvBuffer.length}`);
                break;
            }

            // Extract complete packet
            const fullPacket = this.recvBuffer.subarray(0, packetLen);
            this.recvBuffer = this.recvBuffer.subarray(packetLen);

            this.log('debug', `Packet assembled: ${packetLen} bytes, remaining: ${this.recvBuffer.length}`);

            // Strip length header and process
            const payload = fullPacket.subarray(2);
            this.processPacket(payload);
        }
    }

    processPacket(payload) {
        if (payload.length === 0) {
            this.log('warn', 'Empty packet payload received');
            return;
        }

        const opcode = payload[0];
        this.log('debug', `Processing payload: ${payload.length} bytes, opcode=0x${opcode.toString(16).padStart(2, '0')}`);

        // Pass to PacketHandler
        const result = PacketHandler.handle(payload);

        if (result.success) {
            this.log('info', `Packet decoded: ${result.packet.constructor.name} (opcode 0x${result.opcode.toString(16).padStart(2, '0')})`);
            this.outputPacket(result.packet.toJSON());
        } else {
            this.log('error', `Packet decode failed: ${result.error}`);
            this.outputPacket({
                error: result.error,
                opcode: result.opcode,
                hexDump: result.hexDump
            });
        }

        this.options.onPacketArrival?.(result);
    }

    outputPacket(data) {
        if (!this.options.onPacketArrival) {
            console.log('[GameSession] Packet:', JSON.stringify(data, null, 2));
        }
    }

    handleClose(hadError) {
        this.isConnected = false;
        this.log('info', `Connection closed ${hadError ? '(with error)' : '(clean)'}`);
        this.options.onClose?.(hadError);
    }

    handleError(err) {
        this.log('error', `Socket error: ${err.message}`);
        this.options.onError?.(err);
    }

    log(level, message) {
        if (level === 'debug' && !this.options.debug) return;
        const timestamp = new Date().toISOString();
        console.log(`${timestamp} [GameSession] [${level.toUpperCase()}] ${message}`);
    }
}

function createGameSession(options) {
    return new GameSession(options);
}

// ============================================================================
// Demo
// ============================================================================

console.log('=== GameSession Demo ===\n');

// Example 1: Simulate receiving a packet
console.log('--- Example 1: Single complete packet ---');
const session1 = createGameSession({
    debug: true,
    onPacketArrival: (result) => {
        console.log('[Callback] Result:', result.success ? 'SUCCESS' : 'FAILED');
    }
});

// Create Init packet (opcode 0x00) with some data
const initPacket = Buffer.concat([
    Buffer.from([0x0A, 0x00]),  // Length = 10 (2 header + 8 payload)
    Buffer.from([0x00]),         // Opcode = 0x00 (Init)
    Buffer.from([0x12, 0x34, 0x56, 0x78]), // Session ID
    Buffer.from([0xE2, 0x04, 0x00, 0x00])  // Protocol 746 (0x2E2 = 746)
]);

console.log('Sending simulated Init packet...');
session1.emit('data', initPacket);
session1.disconnect();

// Example 2: Fragmented packet
console.log('\n--- Example 2: Fragmented packet ---');
const session2 = createGameSession({
    debug: true,
    onPacketArrival: (result) => {
        if (result.success) {
            console.log('[Callback] Received:', result.packet.toJSON());
        }
    }
});

const largePacket = Buffer.concat([
    Buffer.from([0x0A, 0x00]),
    Buffer.from([0x00]),
    Buffer.from([0xAA, 0xBB, 0xCC, 0xDD]),
    Buffer.from([0x01, 0x00, 0x00, 0x00])
]);

console.log('Chunk 1: 5 bytes');
session2.emit('data', largePacket.subarray(0, 5));
console.log('Chunk 2: 3 bytes');
session2.emit('data', largePacket.subarray(5, 8));
console.log('Chunk 3: 2 bytes (completes packet)');
session2.emit('data', largePacket.subarray(8));

session2.disconnect();

// Example 3: Unknown opcode
console.log('\n--- Example 3: Unknown opcode ---');
const session3 = createGameSession({ debug: true });

const unknownPacket = Buffer.from([
    0x04, 0x00,  // Length = 4
    0xFF,        // Unknown opcode
    0x11         // Data
]);

session3.emit('data', unknownPacket);
session3.disconnect();

console.log('\n=== Demo complete ===');
console.log('\nTo connect to a real server:');
console.log(`
const session = createGameSession({
    debug: true,
    onPacketArrival: (result) => {
        console.log('Packet:', result);
    },
    onConnect: () => {
        console.log('Connected!');
        // Send protocol version
        const protocol = Buffer.from([0x00, 0xEA, 0x02, 0x00, 0x00]); // 746
        session.sendRaw(Buffer.concat([
            Buffer.from([0x07, 0x00]), // length
            protocol
        ]));
    }
});

session.connectTo('127.0.0.1', 2106);
`);
