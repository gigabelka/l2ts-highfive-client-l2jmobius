import { Router, type Request, type Response } from 'express';
import { GameCommandManager } from '../../game/GameCommandManager';
import { LoginClientNew } from '../../login/LoginClient';
import { GameClientNew } from '../../game/GameClient';
import { Logger } from '../../logger/Logger';
import { CONFIG } from '../../config';
import type { SessionData } from '../../login/types';
import { getContainer } from '../../config/di/appContainer';
import { DI_TOKENS } from '../../config/di/Container';
import type { ICharacterRepository, IWorldRepository, IInventoryRepository, IConnectionRepository } from '../../domain/repositories';
import { ConnectionPhase } from '../../domain/repositories/IConnectionRepository';
import type { IEventBus, IPacketProcessor } from '../../application/ports';
import type { ISystemEventBus } from '../../infrastructure/event-bus';
import type { PacketSerializer } from '../../infrastructure/network/PacketSerializer';
import Connection from '../../network/Connection';

// Repository accessors
const container = getContainer();
const getCharRepo = () => container.resolve<ICharacterRepository>(DI_TOKENS.CharacterRepository).getOrThrow();
const getWorldRepo = () => container.resolve<IWorldRepository>(DI_TOKENS.WorldRepository).getOrThrow();
const getInventoryRepo = () => container.resolve<IInventoryRepository>(DI_TOKENS.InventoryRepository).getOrThrow();
const getEventBus = () => container.resolve<IEventBus>(DI_TOKENS.EventBus).getOrThrow();
const getSystemEventBus = () => container.resolve<ISystemEventBus>(DI_TOKENS.SystemEventBus).getOrThrow();
const getPacketProcessor = () => container.resolve<IPacketProcessor>(DI_TOKENS.PacketProcessor).getOrThrow();
const getConnectionRepo = () => container.resolve<IConnectionRepository>(DI_TOKENS.ConnectionRepository).getOrThrow();
const getPacketSerializer = () => container.resolve<PacketSerializer>(DI_TOKENS.PacketSerializer).getOrThrow();

const router = Router();

// Track active clients for connection management
let activeLoginClient: LoginClientNew | null = null;
let activeGameClient: GameClientNew | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;

/**
 * Login configuration interface
 */
interface LoginConfig {
    Username: string;
    Password: string;
    LoginIp: string;
    LoginPort: number;
    GamePort: number;
    Protocol: number;
    ServerId: number;
    CharSlotIndex: number;
}

/**
 * Helper function to create a new game session
 */
function createGameSession(overrideConfig?: Partial<LoginConfig>): void {
    const config: LoginConfig = overrideConfig ? { ...CONFIG, ...overrideConfig } as LoginConfig : { ...CONFIG } as unknown as LoginConfig;

    Logger.info('ConnectionRoute', 'Creating new game session...');
    Logger.info('ConnectionRoute', `Login: ${config.LoginIp}:${config.LoginPort}`);
    Logger.info('ConnectionRoute', `User: ${config.Username}`);
    Logger.info('ConnectionRoute', `Server: ${config.ServerId}`);

    // Connection state is handled by the clients updating the ConnectionRepository
    const connectionRepo = getConnectionRepo();

    // Create clients with dependencies
    const eventBus = getEventBus();
    const packetProcessor = getPacketProcessor();
    
    activeLoginClient = new LoginClientNew(
        config as unknown as typeof CONFIG, 
        (session: SessionData) => {
            Logger.info('ConnectionRoute', 'Login Server auth successful');
            Logger.info('ConnectionRoute', `Game Server: ${session.gameServerIp}:${session.gameServerPort}`);

            // Create and start GameClient with composition (Connection injected)
            const connection = new Connection();
            activeGameClient = new GameClientNew(session, {
                eventBus,
                systemEventBus: getSystemEventBus(),
                packetProcessor,
                characterRepo: getCharRepo(),
                worldRepo: getWorldRepo(),
                inventoryRepo: getInventoryRepo(),
                connectionRepo,
                commandManager: GameCommandManager,
                packetSerializer: getPacketSerializer(),
            }, connection);
            activeGameClient.start();
        },
        { eventBus, connectionRepo }
    );

    activeLoginClient.start();
}

/**
 * POST /api/v1/connect
 * Initiate connection to server.
 * Body: { overrideConfig?: { host?, loginPort?, login?, password?, characterSlot? } }
 */
router.post('/connect', (req: Request, res: Response) => {
    const { overrideConfig } = req.body;
    const connectionRepo = getConnectionRepo();
    const connectionPhase = connectionRepo.get().phase;

    // Check if already connected or connecting
    if (connectionPhase === ConnectionPhase.IN_GAME || 
        connectionPhase === ConnectionPhase.LOGIN_CONNECTING || 
        connectionPhase === ConnectionPhase.ENTERING_GAME ||
        connectionPhase === ConnectionPhase.LOGIN_AUTHENTICATING ||
        connectionPhase === ConnectionPhase.SELECTING_CHARACTER) {
        res.status(409).json({
            success: false,
            error: {
                code: 'ALREADY_CONNECTING',
                message: `Already in ${connectionPhase} phase`
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    try {
        // Clear any pending reconnect
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }

        // Build override config from request
        const configOverride: Partial<LoginConfig> = {};
        if (overrideConfig) {
            if (overrideConfig.host) configOverride.LoginIp = overrideConfig.host;
            if (overrideConfig.loginPort) configOverride.LoginPort = overrideConfig.loginPort;
            if (overrideConfig.login) configOverride.Username = overrideConfig.login;
            if (overrideConfig.password) configOverride.Password = overrideConfig.password;
            if (typeof overrideConfig.characterSlot === 'number') configOverride.CharSlotIndex = overrideConfig.characterSlot;
        }

        // Start connection process
        createGameSession(configOverride);

        res.status(202).json({
            success: true,
            data: {
                message: 'Connection initiated',
                phase: ConnectionPhase.LOGIN_CONNECTING,
                overrideConfig: overrideConfig || null
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    } catch (error) {
        Logger.error('ConnectionRoute', `Failed to initiate connection: ${error}`);
        res.status(500).json({
            success: false,
            error: {
                code: 'CONNECTION_FAILED',
                message: `Failed to initiate connection: ${error}`
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    }
});

/**
 * POST /api/v1/disconnect
 * Gracefully disconnect from server.
 */
router.post('/disconnect', (req: Request, res: Response) => {
    const connectionRepo = getConnectionRepo();
    const connectionPhase = connectionRepo.get().phase;

    if (connectionPhase === 'DISCONNECTED') {
        res.status(400).json({
            success: false,
            error: {
                code: 'NOT_CONNECTED',
                message: 'Not currently connected'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    try {
        // Clear any pending reconnect
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }

        // Disconnect game client first (if connected)
        if (activeGameClient) {
            Logger.info('ConnectionRoute', 'Disconnecting GameClient...');
            activeGameClient.disconnect();
            activeGameClient = null;
        }

        // Disconnect login client if still connected
        if (activeLoginClient) {
            Logger.info('ConnectionRoute', 'Disconnecting LoginClient...');
            activeLoginClient.disconnect();
            activeLoginClient = null;
        }

        connectionRepo.reset();

        // Unregister from command manager
        GameCommandManager.setGameClient(null);

        // Reset repositories
        getCharRepo().reset();
        getWorldRepo().reset();

        res.json({
            success: true,
            data: {
                message: 'Disconnected gracefully'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    } catch (error) {
        Logger.error('ConnectionRoute', `Error during disconnect: ${error}`);
        res.status(500).json({
            success: false,
            error: {
                code: 'DISCONNECT_ERROR',
                message: `Error during disconnect: ${error}`
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    }
});

/**
 * POST /api/v1/reconnect
 * Reconnect with current configuration.
 * Body: { delayMs?: number }
 */
router.post('/reconnect', (req: Request, res: Response) => {
    const { delayMs } = req.body;
    const delay = delayMs || 3000;

    const connectionRepo = getConnectionRepo();
    const connectionPhase = connectionRepo.get().phase;

    // Clear any pending reconnect
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }

    // Disconnect current connection if any
    if (activeGameClient) {
        activeGameClient.disconnect();
        activeGameClient = null;
    }
    if (activeLoginClient) {
        activeLoginClient.disconnect();
        activeLoginClient = null;
    }

    // Unregister from command manager
    GameCommandManager.setGameClient(null);

    // Reset repositories
    getCharRepo().reset();
    getWorldRepo().reset();

    // Schedule reconnect
    reconnectTimeout = setTimeout(() => {
        Logger.info('ConnectionRoute', 'Executing scheduled reconnect...');
        createGameSession();
    }, delay);

    Logger.info('ConnectionRoute', `Reconnect scheduled in ${delay}ms`);

    res.json({
        success: true,
        data: {
            message: 'Reconnect scheduled',
            delayMs: delay,
            previousPhase: connectionPhase
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

export default router;
