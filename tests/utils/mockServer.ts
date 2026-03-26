import * as net from 'net';
import { EventEmitter } from 'events';
import { TEST_CONFIG } from '../config';
import { PacketReader } from '../../src/network/PacketReader';

/**
 * Mock L2 Server for integration testing
 * Simulates both login and game server responses
 */
export class MockL2Server extends EventEmitter {
    private loginServer: net.Server | null = null;
    private gameServer: net.Server | null = null;
    private loginClients: net.Socket[] = [];
    private gameClients: net.Socket[] = [];
    private isRunning: boolean = false;

    // Opcodes for incoming packets (client -> server)
    private readonly PROTOCOL_VERSION = 0x00;
    private readonly REQUEST_AUTH_LOGIN = 0x08;
    private readonly REQUEST_SERVER_LOGIN = 0x02;

    // Opcodes for outgoing packets (server -> client)
    private readonly INIT_OPCODE = 0x00;
    private readonly LOGIN_OK_OPCODE = 0x03;
    private readonly SERVER_LIST_OPCODE = 0x04;
    private readonly PLAY_OK_OPCODE = 0x07;
    private readonly USER_INFO_OPCODE = 0x04;
    private readonly NPC_INFO_OPCODE = 0x16;
    private readonly ITEM_LIST_OPCODE = 0x1b;

    /**
     * Start both login and game servers
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            throw new Error('Mock server is already running');
        }

        await this.startLoginServer();
        await this.startGameServer();
        this.isRunning = true;

        this.emit('started');
    }

    /**
     * Stop all servers and close connections
     */
    async stop(): Promise<void> {
        // Close all client connections
        this.loginClients.forEach(client => client.destroy());
        this.gameClients.forEach(client => client.destroy());
        this.loginClients = [];
        this.gameClients = [];

        // Close servers
        await Promise.all([
            new Promise<void>((resolve) => {
                if (this.loginServer) {
                    this.loginServer.close(() => resolve());
                } else {
                    resolve();
                }
            }),
            new Promise<void>((resolve) => {
                if (this.gameServer) {
                    this.gameServer.close(() => resolve());
                } else {
                    resolve();
                }
            })
        ]);

        this.loginServer = null;
        this.gameServer = null;
        this.isRunning = false;

        this.emit('stopped');
    }

    /**
     * Send a game packet to all connected game clients
     */
    sendGamePacket(opcode: number, data: Buffer): void {
        for (const client of this.gameClients) {
            if (!client.destroyed) {
                const packet = Buffer.alloc(2 + data.length);
                packet.writeUInt16LE(data.length + 2, 0);
                data.copy(packet, 2);
                client.write(packet);
            }
        }
    }

    /**
     * Simulate damage to the character
     */
    simulateDamage(damage: number, attackerId: number = 999999): void {
        // StatusUpdate packet opcode is 0x0E
        const opcode = 0x0e;
        const data = Buffer.alloc(17);
        data.writeUInt8(opcode, 0);
        data.writeInt32LE(attackerId, 1); // Object ID
        data.writeInt32LE(9, 5); // Attribute: HP
        data.writeInt32LE(damage, 9); // New HP value
        data.writeInt32LE(0, 13); // Padding
        
        this.sendGamePacket(opcode, data);
        this.emit('damage', { damage, attackerId });
    }

    /**
     * Simulate NPC spawn
     */
    spawnNpc(objectId: number, npcId: number, x: number, y: number, z: number): void {
        const data = Buffer.alloc(30);
        let offset = 0;
        
        data.writeUInt8(this.NPC_INFO_OPCODE, offset++);
        data.writeInt32LE(objectId, offset); offset += 4;
        data.writeInt32LE(npcId, offset); offset += 4;
        data.writeInt32LE(1, offset); offset += 4; // isAttackable
        data.writeInt32LE(x, offset); offset += 4;
        data.writeInt32LE(y, offset); offset += 4;
        data.writeInt32LE(z, offset); offset += 4;
        data.writeInt32LE(0, offset); offset += 4; // heading
        data.writeInt32LE(80, offset); // level

        this.sendGamePacket(this.NPC_INFO_OPCODE, data);
        this.emit('npcSpawned', { objectId, npcId, x, y, z });
    }

    /**
     * Send UserInfo packet with character data
     */
    sendUserInfo(characterData: {
        objectId: number;
        name: string;
        race: number;
        sex: number;
        classId: number;
        level: number;
        exp: number;
        str: number;
        dex: number;
        con: number;
        int: number;
        wit: number;
        men: number;
        maxHp: number;
        currentHp: number;
        maxMp: number;
        currentMp: number;
        maxCp: number;
        currentCp: number;
        sp: number;
        currentLoad: number;
        maxLoad: number;
        x: number;
        y: number;
        z: number;
    }): void {
        const nameBuffer = Buffer.from(characterData.name, 'utf16le');
        const data = Buffer.alloc(100 + nameBuffer.length + 2);
        let offset = 0;

        data.writeUInt8(this.USER_INFO_OPCODE, offset++);
        data.writeInt32LE(characterData.x, offset); offset += 4;
        data.writeInt32LE(characterData.y, offset); offset += 4;
        data.writeInt32LE(characterData.z, offset); offset += 4;
        data.writeInt32LE(0, offset); offset += 4; // vehicleId
        data.writeInt32LE(characterData.objectId, offset); offset += 4;
        
        // Write name as null-terminated UTF-16
        nameBuffer.copy(data, offset);
        offset += nameBuffer.length;
        data.writeUInt16LE(0, offset); // null terminator
        offset += 2;

        data.writeInt32LE(characterData.race, offset); offset += 4;
        data.writeInt32LE(characterData.sex, offset); offset += 4;
        data.writeInt32LE(characterData.classId, offset); offset += 4;
        data.writeInt32LE(characterData.level, offset); offset += 4;
        data.writeBigInt64LE(BigInt(characterData.exp), offset); offset += 8;
        data.writeInt32LE(characterData.str, offset); offset += 4;
        data.writeInt32LE(characterData.dex, offset); offset += 4;
        data.writeInt32LE(characterData.con, offset); offset += 4;
        data.writeInt32LE(characterData.int, offset); offset += 4;
        data.writeInt32LE(characterData.wit, offset); offset += 4;
        data.writeInt32LE(characterData.men, offset); offset += 4;
        data.writeInt32LE(characterData.maxHp, offset); offset += 4;
        data.writeInt32LE(characterData.currentHp, offset); offset += 4;
        data.writeInt32LE(characterData.maxMp, offset); offset += 4;
        data.writeInt32LE(characterData.currentMp, offset); offset += 4;
        data.writeInt32LE(characterData.sp, offset); offset += 4;
        data.writeInt32LE(characterData.currentLoad, offset); offset += 4;
        data.writeInt32LE(characterData.maxLoad, offset); offset += 4;

        this.sendGamePacket(this.USER_INFO_OPCODE, data.slice(0, offset));
    }

    /**
     * Send ItemList packet
     */
    sendItemList(items: Array<{
        objectId: number;
        itemId: number;
        slot: number;
        count: number;
        itemType: number;
        customType1: number;
        isEquipped: number;
        bodyPart: number;
        enchantLevel: number;
        customType2: number;
        augmentationId: number;
        mana: number;
    }>, showWindow: boolean = false): void {
        const itemSize = 44; // Size of each item in ItemList packet
        const data = Buffer.alloc(5 + items.length * itemSize);
        let offset = 0;

        data.writeUInt8(this.ITEM_LIST_OPCODE, offset++);
        data.writeUInt16LE(showWindow ? 1 : 0, offset); offset += 2;
        data.writeUInt16LE(items.length, offset); offset += 2;

        for (const item of items) {
            data.writeInt32LE(item.objectId, offset); offset += 4;
            data.writeInt32LE(item.itemId, offset); offset += 4;
            data.writeInt32LE(item.slot, offset); offset += 4;
            data.writeInt32LE(item.count, offset); offset += 4;
            data.writeInt32LE(item.itemType, offset); offset += 4;
            data.writeInt32LE(item.customType1, offset); offset += 4;
            data.writeInt32LE(item.isEquipped, offset); offset += 4;
            data.writeInt32LE(item.bodyPart, offset); offset += 4;
            data.writeInt32LE(item.enchantLevel, offset); offset += 4;
            data.writeInt32LE(item.customType2, offset); offset += 4;
            data.writeInt32LE(item.augmentationId, offset); offset += 4;
            data.writeInt32LE(item.mana, offset); offset += 4;
        }

        this.sendGamePacket(this.ITEM_LIST_OPCODE, data);
    }

    /**
     * Get server status
     */
    getStatus(): { isRunning: boolean; loginClients: number; gameClients: number } {
        return {
            isRunning: this.isRunning,
            loginClients: this.loginClients.length,
            gameClients: this.gameClients.length
        };
    }

    private startLoginServer(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.loginServer = net.createServer((socket) => {
                this.loginClients.push(socket);
                
                socket.on('data', (data) => this.handleLoginPacket(socket, data));
                socket.on('close', () => {
                    const index = this.loginClients.indexOf(socket);
                    if (index > -1) {
                        this.loginClients.splice(index, 1);
                    }
                });
                socket.on('error', (err) => {
                    this.emit('error', { source: 'login', error: err });
                });
            });

            this.loginServer.listen(TEST_CONFIG.mockServer.loginPort, () => {
                resolve();
            });

            this.loginServer.on('error', reject);
        });
    }

    private startGameServer(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.gameServer = net.createServer((socket) => {
                this.gameClients.push(socket);
                
                socket.on('data', (data) => this.handleGamePacket(socket, data));
                socket.on('close', () => {
                    const index = this.gameClients.indexOf(socket);
                    if (index > -1) {
                        this.gameClients.splice(index, 1);
                    }
                });
                socket.on('error', (err) => {
                    this.emit('error', { source: 'game', error: err });
                });
            });

            this.gameServer.listen(TEST_CONFIG.mockServer.gamePort, () => {
                resolve();
            });

            this.gameServer.on('error', reject);
        });
    }

    private handleLoginPacket(socket: net.Socket, data: Buffer): void {
        if (data.length < 2) return;

        const length = data.readUInt16LE(0);
        const opcode = data[2];

        switch (opcode) {
            case this.REQUEST_AUTH_LOGIN:
                this.sendLoginInit(socket);
                break;
            case this.REQUEST_SERVER_LOGIN:
                this.sendServerList(socket);
                break;
            default:
                this.emit('loginPacket', { opcode, length });
        }
    }

    private handleGamePacket(socket: net.Socket, data: Buffer): void {
        if (data.length < 2) return;

        const length = data.readUInt16LE(0);
        
        // Handle multiple packets in one data chunk
        let offset = 0;
        while (offset < data.length) {
            const packetLength = data.readUInt16LE(offset);
            if (offset + packetLength > data.length) break;

            const opcode = data[offset + 2];
            this.emit('gamePacket', { opcode, length: packetLength, data: data.slice(offset, offset + packetLength) });

            offset += packetLength;
        }
    }

    private sendLoginInit(socket: net.Socket): void {
        // Send Init packet with RSA key
        const data = Buffer.alloc(128);
        data[0] = this.INIT_OPCODE;
        data[1] = 0x5e; // Session ID
        data[2] = 0xc3;
        data[3] = 0x75;
        data[4] = 0x8d;
        
        // RSA key modulus (dummy)
        for (let i = 5; i < 128; i++) {
            data[i] = i % 256;
        }

        const packet = Buffer.alloc(2 + data.length);
        packet.writeUInt16LE(data.length + 2, 0);
        data.copy(packet, 2);
        socket.write(packet);
    }

    private sendServerList(socket: net.Socket): void {
        // Send LoginOk followed by ServerList
        const loginOk = Buffer.alloc(2 + 9);
        loginOk.writeUInt16LE(9, 0);
        loginOk[2] = this.LOGIN_OK_OPCODE;
        loginOk.writeBigUInt64LE(BigInt(123456789), 3);
        socket.write(loginOk);

        // ServerList packet
        const serverList = Buffer.alloc(2 + 15);
        serverList.writeUInt16LE(15, 0);
        serverList[2] = this.SERVER_LIST_OPCODE;
        serverList.writeUInt8(1, 3); // Number of servers
        serverList.writeUInt8(1, 4); // Server ID
        serverList.writeUInt32LE(TEST_CONFIG.mockServer.gamePort, 5);
        serverList.writeUInt8(0, 9); // Age limit
        serverList.writeUInt8(1, 10); // PvP
        serverList.writeUInt16LE(100, 11); // Current players
        serverList.writeUInt16LE(2000, 13); // Max players

        setTimeout(() => socket.write(serverList), 50);
    }
}

/**
 * Create packet buffer for testing
 */
export function createTestPacket(opcode: number, data: Buffer): Buffer {
    const packet = Buffer.alloc(1 + data.length);
    packet[0] = opcode;
    data.copy(packet, 1);
    return packet;
}

/**
 * Create UserInfo packet buffer for testing
 */
export function createUserInfoPacket(characterData: ReturnType<typeof import('../config').generateTestCharacter>): Buffer {
    const nameBuffer = Buffer.from(characterData.name, 'utf16le');
    const data = Buffer.alloc(100 + nameBuffer.length + 2);
    let offset = 0;

    data.writeUInt8(0x04, offset++); // UserInfo opcode
    data.writeInt32LE(characterData.x, offset); offset += 4;
    data.writeInt32LE(characterData.y, offset); offset += 4;
    data.writeInt32LE(characterData.z, offset); offset += 4;
    data.writeInt32LE(0, offset); offset += 4; // vehicleId
    data.writeInt32LE(characterData.objectId, offset); offset += 4;
    
    // Write name as null-terminated UTF-16
    nameBuffer.copy(data, offset);
    offset += nameBuffer.length;
    data.writeUInt16LE(0, offset); // null terminator
    offset += 2;

    data.writeInt32LE(characterData.race, offset); offset += 4;
    data.writeInt32LE(characterData.sex, offset); offset += 4;
    data.writeInt32LE(characterData.classId, offset); offset += 4;
    data.writeInt32LE(characterData.level, offset); offset += 4;
    data.writeBigInt64LE(BigInt(characterData.exp), offset); offset += 8;
    data.writeInt32LE(characterData.str, offset); offset += 4;
    data.writeInt32LE(characterData.dex, offset); offset += 4;
    data.writeInt32LE(characterData.con, offset); offset += 4;
    data.writeInt32LE(characterData.int, offset); offset += 4;
    data.writeInt32LE(characterData.wit, offset); offset += 4;
    data.writeInt32LE(characterData.men, offset); offset += 4;
    data.writeInt32LE(characterData.maxHp, offset); offset += 4;
    data.writeInt32LE(characterData.currentHp, offset); offset += 4;
    data.writeInt32LE(characterData.maxMp, offset); offset += 4;
    data.writeInt32LE(characterData.currentMp, offset); offset += 4;
    data.writeInt32LE(characterData.sp, offset); offset += 4;
    data.writeInt32LE(characterData.currentLoad, offset); offset += 4;
    data.writeInt32LE(characterData.maxLoad, offset); offset += 4;

    return data.slice(0, offset);
}

/**
 * Create NpcInfo packet buffer for testing
 */
export function createNpcInfoPacket(npcData: ReturnType<typeof import('../config').generateTestNpc>): Buffer {
    const data = Buffer.alloc(30);
    let offset = 0;

    data.writeUInt8(0x16, offset++); // NpcInfo opcode
    data.writeInt32LE(npcData.objectId, offset); offset += 4;
    data.writeInt32LE(npcData.npcId, offset); offset += 4;
    data.writeInt32LE(npcData.isAttackable, offset); offset += 4;
    data.writeInt32LE(npcData.x, offset); offset += 4;
    data.writeInt32LE(npcData.y, offset); offset += 4;
    data.writeInt32LE(npcData.z, offset); offset += 4;
    data.writeInt32LE(npcData.heading, offset); offset += 4;
    data.writeInt32LE(npcData.level, offset); // level

    return data;
}

/**
 * Create ItemList packet buffer for testing
 */
export function createItemListPacket(items: ReturnType<typeof import('../config').generateTestItems>, showWindow: boolean = false): Buffer {
    const itemSize = 44;
    const data = Buffer.alloc(5 + items.length * itemSize);
    let offset = 0;

    data.writeUInt8(0x1b, offset++); // ItemList opcode
    data.writeUInt16LE(showWindow ? 1 : 0, offset); offset += 2;
    data.writeUInt16LE(items.length, offset); offset += 2;

    for (const item of items) {
        data.writeInt32LE(item.objectId, offset); offset += 4;
        data.writeInt32LE(item.itemId, offset); offset += 4;
        data.writeInt32LE(item.slot, offset); offset += 4;
        data.writeInt32LE(item.count, offset); offset += 4;
        data.writeInt32LE(item.itemType, offset); offset += 4;
        data.writeInt32LE(item.customType1, offset); offset += 4;
        data.writeInt32LE(item.isEquipped, offset); offset += 4;
        data.writeInt32LE(item.bodyPart, offset); offset += 4;
        data.writeInt32LE(item.enchantLevel, offset); offset += 4;
        data.writeInt32LE(item.customType2, offset); offset += 4;
        data.writeInt32LE(item.augmentationId, offset); offset += 4;
        data.writeInt32LE(item.mana, offset); offset += 4;
    }

    return data;
}
