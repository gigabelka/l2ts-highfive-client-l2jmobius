import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameClientNew } from '../../src/game/GameClient';
import { GameClientState } from '../../src/game/GameClientState';
import { SessionData } from '../../src/login/types';
import type { INetworkConnection } from '../../src/network/INetworkConnection';
import { GamePacketProcessor } from '../../src/infrastructure/protocol/game/GamePacketProcessor';
import { GameIncomingPacketFactory } from '../../src/infrastructure/protocol/game/GameIncomingPacketFactory';
import { UserInfoHandler } from '../../src/infrastructure/protocol/game/handlers/UserInfoHandler';
import { IIncomingPacket, IPacketReader } from '../../src/application/ports';

/**
 * Mock network connection for testing
 */
function createMockConnection(): INetworkConnection {
    return {
        connect: vi.fn(),
        disconnect: vi.fn(),
        send: vi.fn(),
        isConnected: vi.fn(() => false),
        onData: vi.fn(),
        onConnect: vi.fn(),
        onDisconnect: vi.fn(),
        onError: vi.fn(),
    };
}

class MockUserInfoPacket implements IIncomingPacket {
    decode(_reader: IPacketReader): this { return this; }
}

describe('PacketProcessor Fallback', () => {
    let gameClient: GameClientNew;
    let mockConnection: INetworkConnection;
    let packetProcessor: GamePacketProcessor;
    let factory: GameIncomingPacketFactory;
    
    const session: SessionData = {
        sessionId: 12345,
        gameServerIp: '127.0.0.1',
        gameServerPort: 27777,
        loginOkId1: 0,
        loginOkId2: 0,
        playOkId1: 0,
        playOkId2: 0,
        ggAuthResponse: 0,
        username: 'test'
    };

    beforeEach(() => {
        factory = new GameIncomingPacketFactory();
        // Register 0x04 as UserInfo
        factory.register(0x04, MockUserInfoPacket as any);
        
        const eventBus = { publish: vi.fn(), subscribe: vi.fn() };
        packetProcessor = new GamePacketProcessor(factory, eventBus as any);
        
        // Register UserInfoHandler - it only handles WAIT_USER_INFO or IN_GAME
        const charRepo = { get: vi.fn(), save: vi.fn(), reset: vi.fn(), update: vi.fn() };
        const handler = new UserInfoHandler(eventBus as any, charRepo as any);
        packetProcessor.registerHandler(handler);

        const deps = {
            eventBus,
            systemEventBus: { publish: vi.fn() },
            packetProcessor,
            characterRepo: charRepo,
            worldRepo: { reset: vi.fn() },
            inventoryRepo: { clear: vi.fn() },
            connectionRepo: { setPhase: vi.fn(), update: vi.fn() },
            commandManager: { setGameClient: vi.fn() },
        };

        mockConnection = createMockConnection();
        gameClient = new GameClientNew(session, deps as any, mockConnection);
    });

    it('should fallback to handleHandshakePacket when opcode 0x04 is received in WAIT_CHAR_LIST state', () => {
        // 1. Set state to WAIT_CHAR_LIST
        (gameClient as any).state = GameClientState.WAIT_CHAR_LIST;

        // 2. Prepare data for 0x04 (CharList in handshake, but UserInfo in registry)
        const data = Buffer.alloc(10);
        data[0] = 0x04;
        data.writeUInt32LE(1, 1); // 1 character

        // 3. Spy on handleHandshakePacket
        const handshakeSpy = vi.spyOn(gameClient as any, 'handleHandshakePacket');

        // 4. Simulate receiving data (wrapped with length 12)
        const fullPacket = Buffer.alloc(12);
        fullPacket.writeUInt16LE(12, 0);
        data.copy(fullPacket, 2);

        // We need to bypass the crypt to make it simple
        vi.spyOn((gameClient as any).crypt, 'decrypt').mockReturnValue(data);

        // 5. Trigger onData
        (gameClient as any).handleRawPacket(fullPacket);

        // 6. Verify expectations
        // PacketProcessor should return success: true (factory knows 0x04) but handlerExecuted: false (state mismatch)
        const result = packetProcessor.process(0x04, data, GameClientState.WAIT_CHAR_LIST);
        expect(result.success).toBe(true);
        expect(result.handlerExecuted).toBe(false);

        // handleHandshakePacket should have been called
        expect(handshakeSpy).toHaveBeenCalledWith(0x04, data);
        
        // State should have transitioned to WAIT_CHAR_SELECTED (because handleHandshakePacket processes 0x04 in WAIT_CHAR_LIST)
        expect(gameClient.getState()).toBe(GameClientState.WAIT_CHAR_SELECTED);
    });

    it('should NOT fallback when opcode 0x04 is received in WAIT_USER_INFO state', () => {
        // 1. Set state to WAIT_USER_INFO
        (gameClient as any).state = GameClientState.WAIT_USER_INFO;

        // 2. Prepare data for UserInfo
        const data = Buffer.alloc(200);
        data[0] = 0x04;
        // ... fill some data if needed, but UserInfoHandler's decode might fail if buffer is too small
        // For this test, we just want to see if it ATTEMPTS to handle it via new architecture

        // 3. Spy on handleHandshakePacket and handlePacket
        const handshakeSpy = vi.spyOn(gameClient as any, 'handleHandshakePacket');
        const handlePacketSpy = vi.spyOn(gameClient as any, 'handlePacket');

        // 4. Simulate receiving data
        const fullPacket = Buffer.alloc(202);
        fullPacket.writeUInt16LE(202, 0);
        data.copy(fullPacket, 2);
        vi.spyOn((gameClient as any).crypt, 'decrypt').mockReturnValue(data);

        // 5. Trigger onData
        (gameClient as any).handleRawPacket(fullPacket);

        // 6. Verify expectations
        // PacketProcessor should return handlerExecuted: true (because it's in WAIT_USER_INFO)
        // Wait, UserInfoHandler.handle might fail decoding, but it's called.
        
        // handlePacket should be called
        expect(handlePacketSpy).toHaveBeenCalled();
        
        // handleHandshakePacket should NOT be called
        expect(handshakeSpy).not.toHaveBeenCalled();
    });
});
