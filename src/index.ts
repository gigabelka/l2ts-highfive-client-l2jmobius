/**
 * @fileoverview Точка входа в приложение (Clean Architecture)
 * @module index
 */

import { CONFIG } from './config';
import { Logger } from './logger/Logger';

// DI Container
import { getContainer } from './config/di/appContainer';
import { DI_TOKENS } from './config/di/Container';
import type { IEventBus, IPacketProcessor } from './application/ports';
import type { ISystemEventBus } from './infrastructure/event-bus';
import type { ICharacterRepository, IWorldRepository, IInventoryRepository, IConnectionRepository } from './domain/repositories';
import type { PacketSerializer } from './infrastructure/network/PacketSerializer';

// Game
import { GameClientNew } from './game/GameClient';
import { LoginClientNew } from './login/LoginClient';
import { initGameCommandManager } from './game/GameCommandManager';
import Connection from './network/Connection';
import { GameState } from './game/GameState';
import { WsApiServer } from './ws/WsServer';
import type { GameState as GameStateType } from './game/GameState';


// API
import { ApiServer } from './api/ApiServer';
import { WsServerNew } from './api/ws/WsServer';

// UI
// import { getDashboard, destroyDashboard } from './ui/Dashboard';
import { destroyDashboard } from './ui/Dashboard';

import type { SessionData } from './login/types';
import { WS_CONFIG } from './config';

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================================

/**
 * Инициализация логирования
 */
function initLogging(): void {
    const logLevel = process.env['LOG_LEVEL']?.toUpperCase() || 'ERROR';
    Logger.level = logLevel as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
}

// Architecture initialization removed - DI container is now lazy-initialized

/**
 * Инициализация API сервера
 */
async function initApiServer(): Promise<{ api: ApiServer; ws: WsServerNew }> {
    const apiServer = new ApiServer();
    const wsServer = new WsServerNew();

    return new Promise((resolve, reject) => {
        apiServer.start(() => {
            const httpServer = apiServer.getServer();
            if (!httpServer) {
                reject(new Error('Failed to start API server'));
                return;
            }

            wsServer.start(httpServer);
            Logger.info('Bootstrap', '✅ API Server and WebSocket are ready!');

            resolve({ api: apiServer, ws: wsServer });
        });
    });
}

/**
 * Инициализация Dashboard
 */
// function initDashboard(): void {
//     const dashboard = getDashboard({
//         autoRender: true,
//         renderInterval: 2000,
//         colored: true,
//         verbose: Logger.level === 'DEBUG'
//     });
// 
//     dashboard.start();
// }

// ============================================================================
// ОБРАБОТКА СОБЫТИЙ
// ============================================================================

// Глобальные ссылки для cleanup
let wsApiServer: WsApiServer | null = null;

/**
 * Инициализация WebSocket API сервера (вызывается до подключения к Game Server)
 */
function initWsApiServer(): void {
    if (!WS_CONFIG.enabled) {
        Logger.info('Bootstrap', 'WebSocket API is disabled');
        return;
    }

    if (wsApiServer) {
        Logger.warn('Bootstrap', 'WebSocket API server already initialized');
        return;
    }

    try {
        const container = getContainer();
        const gameState = container.resolve<GameStateType>(DI_TOKENS.GameState).getOrThrow();

        wsApiServer = new WsApiServer(gameState, {
            port: WS_CONFIG.port,
            authEnabled: WS_CONFIG.authEnabled,
            authTokens: WS_CONFIG.authTokens,
            maxClients: WS_CONFIG.maxClients,
            batchInterval: WS_CONFIG.batchInterval,
            moveThrottleMs: WS_CONFIG.moveThrottleMs,
            debugAudit: WS_CONFIG.debugAudit,
        });

        Logger.info('Bootstrap', `✅ WebSocket API server started on port ${WS_CONFIG.port}`);
    } catch (error) {
        Logger.error('Bootstrap', `Failed to start WebSocket API: ${error}`);
    }
}

/**
 * Обработка завершения логина
 */
function onLoginComplete(session: SessionData): void {
    Logger.info('Bootstrap', '='.repeat(60));
    Logger.info('Bootstrap', 'Login Server auth successful');
    Logger.info('Bootstrap', `Game Server: ${session.gameServerIp}:${session.gameServerPort}`);
    Logger.info('Bootstrap', '='.repeat(60));

    // Получаем зависимости из контейнера
    const container = getContainer();
    const eventBus = container.resolve<IEventBus>(DI_TOKENS.EventBus).getOrThrow();
    const systemEventBus = container.resolve<ISystemEventBus>(DI_TOKENS.SystemEventBus).getOrThrow();
    const packetProcessor = container.resolve<IPacketProcessor>(DI_TOKENS.PacketProcessor).getOrThrow();
    const charRepo = container.resolve<ICharacterRepository>(DI_TOKENS.CharacterRepository).getOrThrow();
    const worldRepo = container.resolve<IWorldRepository>(DI_TOKENS.WorldRepository).getOrThrow();
    const invRepo = container.resolve<IInventoryRepository>(DI_TOKENS.InventoryRepository).getOrThrow();
    const connectionRepo = container.resolve<IConnectionRepository>(DI_TOKENS.ConnectionRepository).getOrThrow();
    const gameState = container.resolve<GameState>(DI_TOKENS.GameState).getOrThrow();

    // Инициализируем GameCommandManager с зависимостями (DI вместо Service Locator)
    const commandManager = initGameCommandManager({
        characterRepo: charRepo,
        worldRepo,
        eventBus,
    });

    // Получаем сериализатор пакетов из DI
    const packetSerializer = container.resolve<PacketSerializer>(DI_TOKENS.PacketSerializer).getOrThrow();

    // Запускаем Game Client
    const connection = new Connection();
    const gameClient = new GameClientNew(session, {
        eventBus,
        systemEventBus,
        packetProcessor,
        characterRepo: charRepo,
        worldRepo,
        inventoryRepo: invRepo,
        connectionRepo,
        commandManager,
        packetSerializer,
        gameState,
    }, connection);

    // Запускаем WS API СНАЧАЛА, чтобы он подписался на PacketBroadcastService
    // ДО того, как GameClient начнёт получать пакеты
    initWsApiServer();

    gameClient.start();
}

/**
 * Graceful shutdown
 */
function shutdown(services: { api: ApiServer; ws: WsServerNew }): void {
    Logger.info('Shutdown', 'Shutting down gracefully...');

    services.api.stop();
    services.ws.stop();

    // Останавливаем WebSocket API сервер
    if (wsApiServer) {
        wsApiServer.stop();
        wsApiServer = null;
    }

    // Очищаем репозитории
    const container = getContainer();
    container.resolve<ICharacterRepository>(DI_TOKENS.CharacterRepository).getOrThrow().reset();
    container.resolve<IWorldRepository>(DI_TOKENS.WorldRepository).getOrThrow().reset();
    container.resolve<IInventoryRepository>(DI_TOKENS.InventoryRepository).getOrThrow().reset();
    container.resolve<IConnectionRepository>(DI_TOKENS.ConnectionRepository).getOrThrow().reset();

    // Останавливаем Dashboard
    destroyDashboard();

    process.exit(0);
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
    // 1. Инициализация логирования
    initLogging();

    Logger.info('Bootstrap', '='.repeat(60));
    Logger.info('Bootstrap', '🎮 L2 Headless Client — Interlude CT0 (Clean Architecture)');
    Logger.info('Bootstrap', '='.repeat(60));
    Logger.info('Bootstrap', `API Server : http://${CONFIG.LoginIp}:3000`);
    Logger.info('Bootstrap', `WS API     : ws://${CONFIG.LoginIp}:${WS_CONFIG.port} (enabled: ${WS_CONFIG.enabled})`);
    Logger.info('Bootstrap', `Login      : ${CONFIG.LoginIp}:${CONFIG.LoginPort}`);
    Logger.info('Bootstrap', `User       : ${CONFIG.Username}`);
    Logger.info('Bootstrap', `Server     : ${CONFIG.ServerId}`);
    Logger.info('Bootstrap', '='.repeat(60));

    // 2. DI container is lazy-initialized on first use

    // 3. Инициализация API сервера
    const services = await initApiServer();

    // 4. Инициализация Dashboard (Отключено для отладки)
    // initDashboard();

    // 5. Настройка graceful shutdown
    process.on('SIGINT', () => shutdown(services));
    process.on('SIGTERM', () => shutdown(services));
    process.on('uncaughtException', (err) => {
        Logger.error('Bootstrap', `Uncaught exception: ${err.message}`);
        shutdown(services);
    });

    // 6. Запуск подключения к игре (если включено)
    const autoConnect = process.env['AUTO_CONNECT_GAME'] !== 'false';
    if (autoConnect) {
        Logger.info('Bootstrap', 'Starting Login Client...');

        setTimeout(() => {
            const container = getContainer();
            const eventBus = container.resolve<IEventBus>(DI_TOKENS.EventBus).getOrThrow();
            const connectionRepo = container.resolve<IConnectionRepository>(DI_TOKENS.ConnectionRepository).getOrThrow();

            const loginClient = new LoginClientNew(CONFIG, onLoginComplete, { eventBus, connectionRepo });
            loginClient.start();
        }, 1000);
    } else {
        Logger.info('Bootstrap', '⏸️  Auto-connect disabled. Set AUTO_CONNECT_GAME=true to enable.');
    }
}

// Запускаем приложение
main().catch((error) => {
    Logger.error('Bootstrap', `Failed to start: ${error}`);
    process.exit(1);
});

// Экспорты для programmatic access
export { getContainer };
