/**
 * @fileoverview Login Protocol Module - централизованная система пакетов Login Server
 * 
 * Паттерны:
 * - Factory: LoginIncomingPacketFactory - создание пакетов по опкоду
 * - Strategy: BaseHandler - обработка пакетов через стратегии
 * - Registry: LoginPacketRegistry - централизованная регистрация
 * 
 * Использование:
 * ```typescript
 * import { 
 *     configureLoginPacketFactory,
 *     configureLoginPacketProcessor,
 *     SessionManager 
 * } from './protocol';
 * 
 * // Создаем компоненты
 * const sessionManager = SessionManager.getInstance();
 * const factory = configureLoginPacketFactory();
 * const processor = new LoginPacketProcessor(factory, sessionManager);
 * configureLoginPacketProcessor(processor, sessionManager);
 * 
 * // Обрабатываем пакет
 * const result = processor.process(opcode, data, currentState);
 * ```
 * @module login/protocol
 */

// Session Management
export {
    SessionManager,
    useSession,
    type SessionData,
    type LoginSessionKey,
    type PlaySessionKey,
    type SessionEvent,
} from '../session/SessionManager';

// Factory
export {
    LoginIncomingPacketFactory,
    loginIncomingPacketFactory,
    type PacketMetadata,
    type PacketConstructor,
} from './LoginIncomingPacketFactory';

// Processor
export {
    LoginPacketProcessor,
    type LoginPacketMiddleware,
    type LoginPacketContext,
    type LoginPacketResult,
    type LoginPacketAction,
} from './LoginPacketProcessor';

// Registry
export {
    configureLoginPacketFactory,
    configureLoginPacketProcessor,
    getRegisteredOpcodes,
    isOpcodeSupported,
    getPacketInfo,
    getFullPacketRegistry,
    getFullHandlerRegistry,
    getRegisteredPacketCount,
    getHandlerCount,
    hasHandler,
} from './LoginPacketRegistry';

// Handlers
export {
    BaseHandler,
    InitHandler,
    type InitData,
    GGAuthHandler,
    LoginOkHandler,
    type LoginOkData,
    LoginFailHandler,
    LoginFailReason,
    getLoginFailReasonMessage,
    ServerListHandler,
    type ServerSelectionResult,
    PlayOkHandler,
    type PlayOkData,
    PlayFailHandler,
    PlayFailReason,
    getPlayFailReasonMessage,
} from './handlers';
