/**
 * @fileoverview Composition Root - конфигурация DI контейнера
 * Здесь регистрируются все зависимости приложения
 * @module config/di
 */

import { Container, DI_TOKENS } from './Container';

// Cache
import { ICacheManager } from '../../infrastructure/cache/ICacheManager';
import { InMemoryCacheManager } from '../../infrastructure/cache/InMemoryCacheManager';

// Services
import { GameDataService } from '../../services/GameDataService';

// Domain & Application
import type {
    ICharacterRepository,
    IWorldRepository,
    IInventoryRepository,
    IConnectionRepository,
} from '../../domain/repositories';
import type {
    IEventBus,
    IStateMachine,
    IIncomingPacketFactory,
    IPacketProcessor,
} from '../../application/ports';

// Infrastructure
import {
    InMemoryCharacterRepository,
    InMemoryWorldRepository,
    InMemoryInventoryRepository,
    InMemoryConnectionRepository,
} from '../../infrastructure/persistence';
import { SimpleEventBus, SystemEventBus } from '../../infrastructure/event-bus';
import {
    createGameStateMachine,
    GameIncomingPacketFactory,
    GamePacketProcessor,
    configurePacketFactory,
    configurePacketProcessor,
} from '../../infrastructure/protocol';
import { globalPacketSerializer } from '../../infrastructure/network/PacketSerializer';

// GameState
import { GameState } from '../../game/GameState';
import { GameStateUpdater } from '../../game/GameStateUpdater';
import type { WsApiServer } from '../../ws/WsServer';

/**
 * Создать и настроить DI контейнер
 */
export function createContainer(): Container {
    const container = new Container();

    // ============================================================================
    // Repositories (Singleton - одно хранилище на приложение)
    // ============================================================================

    container.registerInstance<ICharacterRepository>(
        DI_TOKENS.CharacterRepository,
        new InMemoryCharacterRepository()
    );

    container.registerInstance<IWorldRepository>(
        DI_TOKENS.WorldRepository,
        new InMemoryWorldRepository()
    );

    container.registerInstance<IInventoryRepository>(
        DI_TOKENS.InventoryRepository,
        new InMemoryInventoryRepository()
    );
    
    container.registerInstance<IConnectionRepository>(
        DI_TOKENS.ConnectionRepository,
        new InMemoryConnectionRepository()
    );

    // ============================================================================
    // Event Buses (Singleton - единая шина для доменных и системных событий)
    // ============================================================================

    container.registerInstance<IEventBus>(
        DI_TOKENS.EventBus,
        new SimpleEventBus()
    );

    container.registerInstance(
        DI_TOKENS.SystemEventBus,
        new SystemEventBus()
    );

    // ============================================================================
    // Cache Manager (Singleton)
    // ============================================================================

    const cacheManager = new InMemoryCacheManager();
    container.registerInstance<ICacheManager>(
        DI_TOKENS.CacheManager,
        cacheManager
    );

    // ============================================================================
    // Game Data Service (Singleton) - кэшированный доступ к игровым данным
    // ============================================================================

    container.registerInstance(
        DI_TOKENS.GameDataService,
        new GameDataService(cacheManager)
    );

    // ============================================================================
    // State Machine (Transient - новая для каждого клиента)
    // ============================================================================

    container.register<IStateMachine>(
        DI_TOKENS.StateMachine,
        () => createGameStateMachine(),
        false // transient
    );

    // ============================================================================
    // Packet Factory (Singleton) - configured with all packets
    // ============================================================================

    const packetFactory = configurePacketFactory(new GameIncomingPacketFactory());
    container.registerInstance<IIncomingPacketFactory>(
        DI_TOKENS.PacketFactory,
        packetFactory
    );

    // ============================================================================
    // Packet Serializer (Singleton) - с пулом буферов для оптимизации
    // ============================================================================

    container.registerInstance(
        DI_TOKENS.PacketSerializer,
        globalPacketSerializer
    );

    // ============================================================================
    // GameState (Singleton) - единое хранилище состояния игры
    // ============================================================================

    const gameState = new GameState();
    container.registerInstance(
        DI_TOKENS.GameState,
        gameState
    );

    // ============================================================================
    // GameStateUpdater (Singleton) - мост между пакетами и GameState
    // ============================================================================

    container.registerInstance(
        DI_TOKENS.GameStateUpdater,
        new GameStateUpdater(gameState)
    );

    // ============================================================================
    // WsApiServer (Singleton) - будет инициализирован позже после входа в игру
    // ============================================================================

    container.register<WsApiServer>(
        DI_TOKENS.WsApiServer,
        () => {
            // Lazy initialization - создаётся при первом resolve после входа в игру
            const { WsApiServer: WsApiServerClass } = require('../../ws/WsServer');
            const { WS_CONFIG } = require('../../config');
            return new WsApiServerClass(gameState, {
                port: WS_CONFIG.port,
                authEnabled: WS_CONFIG.authEnabled,
                authTokens: WS_CONFIG.authTokens,
                maxClients: WS_CONFIG.maxClients,
            });
        },
        false // transient - создаётся один раз при первом вызове
    );

    // ============================================================================
    // Packet Processor (Transient) - configured with all handlers
    // ============================================================================

    container.register<IPacketProcessor>(
        DI_TOKENS.PacketProcessor,
        (c) => {
            const factory = c.resolve<IIncomingPacketFactory>(DI_TOKENS.PacketFactory).getOrThrow();
            const eventBus = c.resolve<IEventBus>(DI_TOKENS.EventBus).getOrThrow();
            const processor = new GamePacketProcessor(factory as GameIncomingPacketFactory, eventBus);
            
            // Configure handlers with repositories
            configurePacketProcessor(
                processor,
                eventBus,
                {
                    character: c.resolve<ICharacterRepository>(DI_TOKENS.CharacterRepository).getOrThrow(),
                    world: c.resolve<IWorldRepository>(DI_TOKENS.WorldRepository).getOrThrow(),
                    inventory: c.resolve<IInventoryRepository>(DI_TOKENS.InventoryRepository).getOrThrow(),
                }
            );

            // Add middleware for GameStateUpdater
            const gameStateUpdater = c.resolve<GameStateUpdater>(DI_TOKENS.GameStateUpdater).getOrThrow();
            processor.use((context, packet, next) => {
                // Call next first to let handlers process the packet
                next();
                
                // After handlers process the packet, update GameState
                if (packet && 'opcode' in packet) {
                    const opcode = (packet as { opcode: number }).opcode;
                    // Get parsed data from packet if available
                    const data = 'getData' in packet 
                        ? (packet as { getData: () => unknown }).getData() 
                        : context.rawBody;
                    gameStateUpdater.handlePacket(opcode, data);
                }
            });
            
            return processor;
        },
        false // transient
    );

    return container;
}

/**
 * Создать тестовый контейнер с mock-реализациями
 */
export function createTestContainer(): Container {
    // Для тестов используем те же in-memory реализации
    // но можно заменить на mock-объекты
    return createContainer();
}
