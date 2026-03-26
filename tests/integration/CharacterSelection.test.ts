import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameClientNew } from '../../src/game/GameClient';
import { getContainer, resetContainer } from '../../src/config/di/appContainer';
import { GameClientState } from '../../src/game/GameClientState';
import { SessionData } from '../../src/login/types';
import type { INetworkConnection } from '../../src/network/INetworkConnection';
import { CONFIG } from '../../src/config';

import { DI_TOKENS } from '../../src/config/di/Container';

// Protocol-specific opcodes
const CHAR_SELECT_INFO_OPCODE = CONFIG.Protocol === 267 ? 0x09 : 0x13;
const CHAR_SELECTED_OPCODE = CONFIG.Protocol === 267 ? 0x0B : 0x15;

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

describe('GameClient Selection Flow', () => {
    let gameClient: GameClientNew;
    let mockConnection: INetworkConnection;
    
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

    beforeEach(async () => {
        // Reset container for clean state
        resetContainer();

        const container = getContainer();
        const deps = {
            eventBus: container.resolve(DI_TOKENS.EventBus).getOrThrow(),
            systemEventBus: container.resolve(DI_TOKENS.SystemEventBus).getOrThrow(),
            packetProcessor: container.resolve(DI_TOKENS.PacketProcessor).getOrThrow(),
            characterRepo: container.resolve(DI_TOKENS.CharacterRepository).getOrThrow(),
            worldRepo: container.resolve(DI_TOKENS.WorldRepository).getOrThrow(),
            inventoryRepo: container.resolve(DI_TOKENS.InventoryRepository).getOrThrow(),
            connectionRepo: container.resolve(DI_TOKENS.ConnectionRepository).getOrThrow(),
            commandManager: { setGameClient: vi.fn() },
        };

        mockConnection = createMockConnection();
        gameClient = new GameClientNew(session, deps as any, mockConnection);
    });

    it(`should transition to WAIT_CHAR_SELECTED after receiving CharSelectInfo (0x${CHAR_SELECT_INFO_OPCODE.toString(16)})`, () => {
        // 1. Manually set state to WAIT_CHAR_LIST
        (gameClient as any).state = GameClientState.WAIT_CHAR_LIST;

        // 2. Simulate receiving CharSelectInfo (protocol-specific opcode)
        const charSelectInfo = Buffer.alloc(10);
        charSelectInfo[0] = CHAR_SELECT_INFO_OPCODE;
        charSelectInfo.writeUInt32LE(1, 1); // 1 character
        
        // This should trigger CharacterSelected and move to WAIT_CHAR_SELECTED
        (gameClient as any).handleHandshakePacket(CHAR_SELECT_INFO_OPCODE, charSelectInfo);
        
        expect((gameClient as any).state).toBe(GameClientState.WAIT_CHAR_SELECTED);
    });

    it(`should transition to WAIT_USER_INFO after receiving CharSelected (0x${CHAR_SELECTED_OPCODE.toString(16)})`, () => {
        // 1. Manually set state to WAIT_CHAR_SELECTED (simulating previous step)
        (gameClient as any).state = GameClientState.WAIT_CHAR_SELECTED;

        // 2. Simulate receiving CharSelected (protocol-specific opcode)
        const charSelected = Buffer.alloc(1);
        charSelected[0] = CHAR_SELECTED_OPCODE;
        
        // This should trigger handleCharSelected and move to WAIT_USER_INFO
        (gameClient as any).handleHandshakePacket(CHAR_SELECTED_OPCODE, charSelected);
        
        expect((gameClient as any).state).toBe(GameClientState.WAIT_USER_INFO);
    });
});
