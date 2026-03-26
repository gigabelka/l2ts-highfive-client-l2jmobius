// Infrastructure Layer Exports

// Persistence
export {
    InMemoryCharacterRepository,
    InMemoryWorldRepository,
    InMemoryInventoryRepository,
    InMemoryConnectionRepository,
} from './persistence';

// Event Bus
export { SimpleEventBus, SystemEventBus } from './event-bus';
export type { ISystemEventBus, SystemEvent, SystemEventHandler } from './event-bus';

// Protocol
export {
    StateMachine,
    StateMachineBuilder,
    createGameStateMachine,
    createLoginStateMachine,
} from './protocol';

// Game Protocol
export {
    GameIncomingPacketFactory,
    gameIncomingPacketFactory,
    GamePacketProcessor,
    BasePacketHandlerStrategy,
    type PacketMetadata,
    type PacketConstructor,
    type PacketMiddleware,
} from './protocol/game';

// Adapters
// (empty - GameStateStoreAdapter removed as dead code)
