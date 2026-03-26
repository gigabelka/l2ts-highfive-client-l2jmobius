/**
 * @fileoverview GameClientNew - Game Client с Clean Architecture и композицией
 * Использует композицию вместо наследования для улучшения тестируемости
 * @module game/GameClientNew
 */

import { Logger } from '../logger/Logger';
import { GameClientState } from './GameClientState';
import type { SessionData } from '../login/types';
import { GameCrypt } from './GameCrypt';
import { CONFIG } from '../config';
import { Result } from '../shared/result';
import type { INetworkConnection } from '../network/INetworkConnection';
import { PacketSerializer, globalPacketSerializer } from '../infrastructure/network/PacketSerializer';

// New Architecture imports
import type { IEventBus, IPacketProcessor } from '../application/ports';
import type { ICharacterRepository, IWorldRepository, IInventoryRepository } from '../domain/repositories';
import type { ISystemEventBus } from '../infrastructure/event-bus';

import { CharacterEnteredGameEvent, ConnectionPhaseChangedEvent } from '../domain/events';
import { IConnectionRepository, ConnectionPhase } from '../domain';

// Packets
import { ProtocolVersion } from './packets/outgoing/ProtocolVersion';
import { CharacterSelected } from './packets/outgoing/CharacterSelected';
import { AuthRequest } from './packets/outgoing/AuthRequest';
import { RequestInventoryOpen } from './packets/outgoing/RequestInventoryOpen';
import { OutgoingGamePacket } from './packets/outgoing/OutgoingGamePacket';

// Services
import type { GameCommandManagerClass } from './GameCommandManager';
import type { IGameClient } from './IGameClient';
import type { GameState } from './GameState';

/**
 * Dependencies for GameClient
 */
export interface GameClientDependencies {
    eventBus: IEventBus;           // Domain events для бизнес-логики
    systemEventBus: ISystemEventBus; // System events для мониторинга
    packetProcessor: IPacketProcessor;
    characterRepo: ICharacterRepository;
    worldRepo: IWorldRepository;
    inventoryRepo: IInventoryRepository;
    connectionRepo: IConnectionRepository;
    commandManager: GameCommandManagerClass;
    packetSerializer?: PacketSerializer; // Опционально: сериализатор с pooling
    gameState?: GameState; // Опционально: для сброса состояния при отключении
}

/**
 * Game Server connection client with Clean Architecture
 * Использует композицию вместо наследования для лучшей тестируемости
 */
export class GameClientNew implements IGameClient {
    private state: GameClientState = GameClientState.IDLE;
    private crypt: GameCrypt = new GameCrypt();
    private deps: GameClientDependencies;
    private inventoryRetryTimer: ReturnType<typeof setTimeout> | null = null;

    private packetSerializer: PacketSerializer;

    constructor(
        private session: SessionData,
        deps: GameClientDependencies,
        private connection: INetworkConnection // Инъекция зависимости через композицию
    ) {
        this.deps = deps;
        this.packetSerializer = deps.packetSerializer ?? globalPacketSerializer;
        this.setupConnectionEvents();
    }

    /**
     * Setup connection event handlers
     */
    private setupConnectionEvents(): void {
        this.connection.onConnect(() => this.handleConnect());
        this.connection.onDisconnect(() => this.handleDisconnect());
        this.connection.onError((error) => this.handleError(error));
        this.connection.onData((data) => this.handleRawPacket(data));
    }

    start(): Result<void, Error> {
        try {
            Logger.logState(this.state, GameClientState.CONNECTING);
            Logger.info('GameClient', `Connecting to Game Server: ${this.session.gameServerIp}:${this.session.gameServerPort}`);
            this.state = GameClientState.CONNECTING;

            // Initialize services
            this.deps.commandManager.setGameClient(this);

            // Update connection state via repository
            this.publishConnectionState(ConnectionPhase.ENTERING_GAME);

            this.connection.connect(this.session.gameServerIp, this.session.gameServerPort);
            return Result.ok(undefined);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            Logger.error('GameClient', `Failed to start: ${message}`);
            this.state = GameClientState.ERROR;
            return Result.err(new Error(`Failed to start GameClient: ${message}`));
        }
    }

    private handleConnect(): void {
        Logger.info('GameClient', 'Connected to Game Server');
        Logger.logState(this.state, GameClientState.WAIT_CRYPT_INIT);
        this.state = GameClientState.WAIT_CRYPT_INIT;

        const pv = new ProtocolVersion();
        this.sendPacketRawBuffer(pv.encode());
    }

    private handleDisconnect(): void {
        Logger.info('GameClient', '*** GAME SERVER CONNECTION CLOSED ***');

        this.deps.commandManager.setGameClient(null);

        // Clear inventory retry timer to prevent memory leak
        if (this.inventoryRetryTimer) {
            clearTimeout(this.inventoryRetryTimer);
            this.inventoryRetryTimer = null;
        }

        // Clear repositories
        this.deps.characterRepo.reset();
        this.deps.worldRepo.reset();
        this.deps.inventoryRepo.clear();

        // Reset GameState if available (sends 'disconnected' event to WS clients)
        if (this.deps.gameState) {
            this.deps.gameState.reset();
            this.deps.gameState.update('disconnected', { reason: 'Connection closed' });
        }

        this.publishConnectionState(ConnectionPhase.DISCONNECTED);
        this.publishDisconnectedEvent();
    }

    private handleError(err: Error): void {
        Logger.error('GameClient', `*** GAME SERVER ERROR: ${err.message} ***`);
        this.state = GameClientState.ERROR;
        this.publishConnectionState(ConnectionPhase.ERROR);
        this.deps.connectionRepo.update({ error: err.message });
        this.publishErrorEvent(err.message);
    }

    private handleRawPacket(fullPacket: Buffer): void {
        const encryptedBody = fullPacket.subarray(2);
        const body = this.crypt.decrypt(encryptedBody);
        const opcode = body[0]!;

        Logger.info('GameClient', `[RECV] opcode=0x${opcode.toString(16).padStart(2, '0')} state=${this.state}`);
        Logger.logPacket('RECV', opcode, fullPacket);
        Logger.debug('GameClient', `[state=${this.state}] opcode=0x${opcode.toString(16).padStart(2, '0')} bodyLen=${body.length}`);
        Logger.hexDump('RECV DECRYPTED', body, Math.min(body.length, 64));

        // Publish raw packet event
        this.publishRawPacketEvent(opcode, body.length);

        // Process packet with new architecture
        const result = this.deps.packetProcessor.process(opcode, body, this.state);

        if (result.success && result.handlerExecuted) {
            Logger.debug('GameClient', `Processed packet opcode=0x${opcode.toString(16).padStart(2, '0')} via new architecture in state=${this.state}`);
            this.handlePacket(result.packet, opcode);
        } else {
            // Handle packets not processed by the new system (handshake packets or legacy fallback)
            if (result.success) {
                Logger.debug('GameClient', `Packet 0x${opcode.toString(16).padStart(2, '0')} recognized but NOT handled by new architecture in state=${this.state}. Falling back to legacy handler.`);
            }
            this.handleHandshakePacket(opcode, body);
        }
    }

    private handlePacket(_packet: unknown, opcode: number): void {
        // Post-processing for state transitions
        switch (this.state) {
            case GameClientState.WAIT_CHAR_SELECTED:
                if (opcode === 0x04) {
                    const expectedConfirmOpcode = CONFIG.Protocol === 267 ? '0x1D' : '0x15';
                    Logger.info('GameClient', `Server skipped CharSelected (${expectedConfirmOpcode}) confirmation. Transitioning to UserInfo.`);
                    this.handleCharSelected();
                    this.onUserInfoReceived(opcode);
                }
                break;
            case GameClientState.WAIT_USER_INFO:
                if (opcode === 0x04) {
                    this.onUserInfoReceived(opcode);
                }
                break;

            case GameClientState.IN_GAME:
                // Handle ping - moved to handleHandshakePacket where body is accessible
                break;
        }
    }

    private handleHandshakePacket(opcode: number, body: Buffer): void {
        Logger.info('GameClient', `handleHandshakePacket: opcode=0x${opcode.toString(16).padStart(2, '0')} state=${this.state}`);
        // Handle handshake packets that aren't in the new processor yet
        switch (this.state) {
            case GameClientState.WAIT_CRYPT_INIT: {
                // Check expected opcodes based on protocol version
                const expectedOpcodes = CONFIG.Protocol === 267
                    ? [0x2E] // HighFive: CryptInit (REAL OPCODE from server traffic)
                    : [0x00, 0x2D]; // CT_0_Interlude: CryptInit

                if (!expectedOpcodes.includes(opcode)) {
                    const protocolName = CONFIG.Protocol === 267 ? 'HighFive' : 'CT_0_Interlude';
                    const expectedHex = expectedOpcodes.map(op => `0x${op.toString(16)}`).join(', ');
                    Logger.warn('GameClient', `Expected ${protocolName} CryptInit (${expectedHex}), got 0x${opcode.toString(16)}`);
                    return;
                }

                // Parse CryptInit (23 bytes for L2J_Mobius)
                // Offset 1: result (1 = success)
                // Offset 2-9: XOR key (8 bytes)
                // Offset 10-13: encryption flag (0 = disabled for CT_0, ignored for HighFive)
                const result = body[1];
                if (result !== 1) {
                    Logger.error('GameClient', `ProtocolVersion rejected by server! result=${result}`);
                    return;
                }

                // Get XOR key and encryption flag
                const xorKeyData = body.subarray(2, 10);
                const serverEncryptionFlag = body.readUInt32LE(10) !== 0;

                // For HighFive (protocol 267), always enable encryption regardless of server flag
                // For CT_0_Interlude (protocol 746), server sent flag=0 to disable encryption
                const useEncryption = CONFIG.Protocol === 267 ? true : serverEncryptionFlag;

                // Initialize crypto
                this.crypt.initKey(xorKeyData, useEncryption);

                Logger.info('GameClient', `Encryption: serverFlag=${serverEncryptionFlag}, protocol=${CONFIG.Protocol}, final=${useEncryption}`);

                Logger.info('GameClient', 'Sending AuthLogin (0x08)...');
                this.sendPacket(new AuthRequest(this.session, CONFIG.Username));

                Logger.logState(this.state, GameClientState.WAIT_CHAR_LIST);
                this.state = GameClientState.WAIT_CHAR_LIST;
                return;
            }

            case GameClientState.WAIT_CHAR_LIST: {
                // Check expected opcodes based on protocol version
                const expectedOpcodes = CONFIG.Protocol === 267
                    ? [0x09] // HighFive: CharSelectionInfo
                    : [0x04, 0x13, 0x2C]; // CT_0_Interlude: CharSelectInfo

                if (expectedOpcodes.includes(opcode)) {
                    // CharSelectInfo received
                    const charCount = body.readUInt32LE(1);
                    const protocolName = CONFIG.Protocol === 267 ? 'HighFive' : 'CT_0_Interlude';
                    Logger.info('GameClient', `${protocolName} CharSelectInfo received: ${charCount} character(s) [opcode=0x${opcode.toString(16)}]`);

                    // Select character
                    Logger.info('GameClient', `Sending CharacterSelect for slot ${CONFIG.CharSlotIndex}...`);
                    this.sendPacket(new CharacterSelected(CONFIG.CharSlotIndex));

                    Logger.logState(this.state, GameClientState.WAIT_CHAR_SELECTED);
                    this.state = GameClientState.WAIT_CHAR_SELECTED;
                    this.publishConnectionState(ConnectionPhase.SELECTING_CHARACTER);
                }
                return;
            }

            case GameClientState.WAIT_CHAR_SELECTED: {
                // Check expected opcodes based on protocol version
                const expectedOpcodes = CONFIG.Protocol === 267
                    ? [0x1D] // HighFive: CharSelected
                    : [0x15]; // CT_0_Interlude: CharSelected

                if (expectedOpcodes.includes(opcode)) {
                    const protocolName = CONFIG.Protocol === 267 ? 'HighFive' : 'CT_0_Interlude';
                    Logger.info('GameClient', `${protocolName} CharSelected confirmation received [opcode=0x${opcode.toString(16)}]`);
                    this.handleCharSelected();
                }
                return;
            }

            default:
                // Handle NetPingRequest (0xD3) in any state when in game
                if (opcode === 0xD3 && this.state === GameClientState.IN_GAME) {
                    // NetPingRequest - respond with pong
                    // Packet structure: opcode (1) + pingId (4 bytes, int32LE)
                    const pingId = body.readInt32LE(1);
                    const pong = Buffer.allocUnsafe(5);
                    pong[0] = 0xA8;
                    pong.writeInt32LE(pingId, 1);
                    this.sendPacketRawBuffer(pong);
                    Logger.debug('GameClient', `pingId=${pingId} -> Pong`);
                    return;
                }
                Logger.warn('GameClient', `Packet in state ${this.state}, opcode=0x${opcode.toString(16)}`);
        }
    }

    private handleCharSelected(): void {
        Logger.logState(this.state, GameClientState.WAIT_USER_INFO);
        this.state = GameClientState.WAIT_USER_INFO;

        if (CONFIG.Protocol === 267) {
            // HighFive: Send single standard EnterWorld packet (0x11)
            Logger.info('GameClient', 'Sending HighFive EnterWorld (0x11)...');
            const { EnterWorld } = require('./packets/outgoing/EnterWorld');
            this.sendPacket(new EnterWorld());
        } else {
            // CT_0_Interlude: Send special 3-packet sequence
            Logger.info('GameClient', 'Sending CT_0 EnterWorld sequence (0x9D + 0xD0 0x08 0x00 + 0x03)...');
            this.sendPacketRawBuffer(Buffer.from([0x9D]));
            this.sendPacketRawBuffer(Buffer.from([0xD0, 0x08, 0x00]));

            const enterWorldPayload = Buffer.alloc(105, 0);
            enterWorldPayload[0] = 0x03;
            this.sendPacketRawBuffer(enterWorldPayload);
        }
    }

    sendPacket(packet: OutgoingGamePacket): Result<void, Error> {
        try {
            const body = packet.encode();
            Logger.debug('GameClient', `sendPacket: body length from encode() = ${body.length}`);
            
            const encrypted = this.crypt.encrypt(body);
            Logger.debug('GameClient', `sendPacket: encrypted length = ${encrypted.length}`);

            const { buffer, cleanup } = this.packetSerializer.serializeRawWithHeader(encrypted);
            Logger.debug('GameClient', `sendPacket: framed buffer length = ${buffer.length}`);
            
            this.connection.send(buffer);

            // Release buffer back to pool after send
            setImmediate(cleanup);

            return Result.ok(undefined);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            Logger.error('GameClient', `Failed to send packet: ${message}`);
            return Result.err(new Error(`Failed to send packet: ${message}`));
        }
    }

    private sendPacketRawBuffer(buffer: Buffer): void {
        Logger.debug('GameClient', `-> Buffer len=${buffer.length}`);

        const { buffer: framedBuffer, cleanup } = this.packetSerializer.serializeRawWithHeader(buffer);
        this.connection.send(framedBuffer);

        // Release buffer back to pool
        setImmediate(cleanup);
    }

    /**
     * Disconnect from game server
     */
    disconnect(): void {
        this.connection.disconnect();
    }

    /**
     * Get current connection state
     */
    getState(): GameClientState {
        return this.state;
    }

    /**
     * Check if client is connected
     */
    isConnected(): boolean {
        return this.connection.isConnected();
    }

    // ============================================================================
    // Event Publishing Helpers
    // ============================================================================

    private publishConnectionState(phase: ConnectionPhase): void {
        this.deps.connectionRepo.setPhase(phase);
        this.deps.eventBus.publish(new ConnectionPhaseChangedEvent({ phase }));
        if (phase === ConnectionPhase.ENTERING_GAME) {
            this.deps.connectionRepo.update({ host: this.session.gameServerIp, port: this.session.gameServerPort });
        }
    }

    private publishRawPacketEvent(opcode: number, length: number): void {
        this.deps.systemEventBus.publish({
            type: 'system.raw_packet',
            channel: 'network',
            payload: {
                opcode,
                opcodeHex: `0x${opcode.toString(16).padStart(2, '0')}`,
                length,
                state: this.state,
            },
            timestamp: new Date(),
        });
    }

    private publishConnectedEvent(_characterName: string): void {
        const char = this.deps.characterRepo.get();
        if (!char) return;

        this.deps.eventBus.publish(new CharacterEnteredGameEvent({
            objectId: char.id,
            name: char.name,
            level: char.level,
            classId: char.classId,
            raceId: char.raceId,
            sex: char.sex,
            position: char.position,
        }));
    }

    private publishDisconnectedEvent(): void {
        this.deps.systemEventBus.publish({
            type: 'system.disconnected',
            channel: 'system',
            payload: {
                reason: 'Connection closed',
                phase: 'DISCONNECTED',
                willReconnect: false,
            },
            timestamp: new Date(),
        });
    }

    private publishErrorEvent(message: string): void {
        this.deps.systemEventBus.publish({
            type: 'system.error',
            channel: 'system',
            payload: {
                code: 'GAME_CONNECTION_ERROR',
                message,
            },
            timestamp: new Date(),
        });
    }

    /**
     * Обработка получения UserInfo (0x04)
     */
    private onUserInfoReceived(opcode: number): void {
        if (opcode !== 0x04) return;

        // UserInfo received - character is now in game
        const char = this.deps.characterRepo.get();
        if (char) {
            Logger.info('GameClient', `ENTERED GAME WORLD AS: ${char.name}`);
            Logger.logState(this.state, GameClientState.IN_GAME);
            this.state = GameClientState.IN_GAME;

            this.publishConnectionState(ConnectionPhase.IN_GAME);
            this.publishConnectedEvent(char.name);

            // Request inventory
            Logger.info('GameClient', 'Requesting inventory...');
            this.sendPacket(new RequestInventoryOpen());

            // Retry inventory request after 3 seconds
            this.inventoryRetryTimer = setTimeout(() => {
                const state = this.deps.inventoryRepo.getState();
                if (state.items.length === 0) {
                    Logger.info('GameClient', 'Inventory empty, retrying request...');
                    this.sendPacket(new RequestInventoryOpen());
                }
                this.inventoryRetryTimer = null;
            }, 3000);
        }
    }
}
