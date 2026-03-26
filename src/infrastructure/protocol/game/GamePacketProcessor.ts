/**
 * @fileoverview GamePacketProcessor - процессор пакетов с паттерном Strategy
 * Координирует фабрику пакетов и стратегии обработки
 * @module infrastructure/protocol/game
 */


import type {
    IPacketProcessor,
    IPacketHandlerStrategy,
    PacketContext,
    PacketResult,
    IIncomingPacket,
} from '../../../application/ports';
import type { IEventBus } from '../../../application/ports';
import type { GameIncomingPacketFactory } from './GameIncomingPacketFactory';
import { PacketReader } from '../../../network/PacketReader';
import { PacketBroadcastService } from '../../../services/PacketBroadcastService';
import { WsAuditService } from '../../../services/WsAuditService';

/**
 * Middleware для обработки пакетов
 */
export type PacketMiddleware = (
    context: PacketContext,
    packet: IIncomingPacket | null,
    next: () => void
) => void;

/**
 * Процессор пакетов Game Server
 * Соединяет Factory и Strategy паттерны
 * 
 * Архитектурный принцип: каждый пакет от сервера СНАЧАЛА отправляется в WS,
 * ПОТОМ обрабатывается внутренней логикой.
 */
export class GamePacketProcessor implements IPacketProcessor {
    private handlers: IPacketHandlerStrategy[] = [];
    private middlewares: PacketMiddleware[] = [];
    private broadcastService: PacketBroadcastService;
    private auditService: WsAuditService;

    constructor(
        private factory: GameIncomingPacketFactory,
        _eventBus: IEventBus
    ) {
        this.broadcastService = PacketBroadcastService.getInstance();
        this.auditService = WsAuditService.getInstance();
    }

    /**
     * Регистрация стратегии обработки
     */
    registerHandler(handler: IPacketHandlerStrategy): void {
        this.handlers.push(handler);
    }

    /**
     * Регистрация middleware
     */
    use(middleware: PacketMiddleware): this {
        this.middlewares.push(middleware);
        return this;
    }

    /**
     * Обработать пакет
     * 
     * ВАЖНО: Broadcast в WebSocket выполняется ДО внутренней обработки,
     * чтобы гарантировать, что WS-клиент видит всё то же, что и клиент.
     */
    process(opcode: number, data: Buffer, state: string): PacketResult {
        // === АУДИТ: Учитываем КАЖДЫЙ полученный пакет ===
        this.auditService.incrementReceived();

        const context: PacketContext = {
            opcode,
            state,
            timestamp: Date.now(),
            rawBody: data,
        };

        // Проверяем поддержку опкода
        if (!this.factory.supports(opcode)) {
            // Даже неизвестные опкоды отправляем в WS для отладки
            this.broadcastService.broadcastRaw(opcode, 'UnknownPacket', data, 'server_to_client');
            
            return {
                success: false,
                error: `Unknown opcode: 0x${opcode.toString(16).padStart(2, '0')}`,
                context,
            };
        }

        // Получаем метаданные пакета для имени
        const metadata = this.factory.getMetadata(opcode);
        const packetName = metadata?.name || `Packet_0x${opcode.toString(16).padStart(2, '0')}`;

        // Создаем пакет через фабрику
        const createResult = this.factory.createFromBuffer(opcode, data);
        if (createResult.isErr()) {
            // Даже при ошибке создания отправляем в WS сырые данные
            this.broadcastService.broadcastRaw(opcode, packetName, data, 'server_to_client');
            
            return {
                success: false,
                error: createResult.error?.message || 'Unknown error',
                context,
            };
        }

        const packet = createResult.getOrThrow();

        // === ДЕКОДИРУЕМ ПАКЕТ СРАЗУ ПОСЛЕ СОЗДАНИЯ ===
        // Фабрика создаёт пакет, но НЕ вызывает decode() - делаем это здесь
        try {
            const reader = new PacketReader(data, 1); // пропускаем 1 байт opcode
            packet.decode(reader);
        } catch (decodeError) {
            console.error(`[GamePacketProcessor] Decode error for opcode ${opcode}:`, decodeError);
            // Продолжаем обработку - пакет будет отправлен в WS как raw
        }

        // === ВАЖНО: Broadcast в WebSocket СНАЧАЛА ===
        // Получаем распарсенные данные из пакета если возможно
        let packetData: unknown;
        try {
            if ('getData' in packet && typeof (packet as { getData?: unknown }).getData === 'function') {
                packetData = (packet as { getData: () => unknown }).getData();
            } else {
                // Если getData недоступен, используем сырые данные
                packetData = { 
                    rawLength: data.length,
                    rawHex: data.toString('hex').slice(0, 200)
                };
            }
        } catch (err) {
            packetData = { 
                rawLength: data.length,
                rawHex: data.toString('hex').slice(0, 200),
                parseError: true,
                errorMessage: err instanceof Error ? err.message : String(err)
            };
        }

        // Отправляем в WS (неблокирующе, с защитой от ошибок)
        try {
            this.broadcastService.broadcast(opcode, packetName, packetData, 'server_to_client');
        } catch (error) {
            // Логируем ошибку, но не прерываем обработку пакета
            console.error(`[GamePacketProcessor] Broadcast error for opcode ${opcode}:`, error);
        }

        // === Теперь выполняем middleware chain и обработчики ===
        let middlewareIndex = 0;
        let handlerExecuted = false;

        const executeMiddleware = (): void => {
            if (middlewareIndex < this.middlewares.length) {
                const mw = this.middlewares[middlewareIndex++];
                if (mw) {
                    mw(context, packet, executeMiddleware);
                }
            } else {
                // После всех middleware выполняем обработчики
                handlerExecuted = this.executeHandlers(context, packet);
            }
        };

        executeMiddleware();

        return {
            success: true,
            packet,
            handlerExecuted,
            context,
        };
    }

    /**
     * Выполнить стратегии обработки
     * @returns true если хотя бы один обработчик выполнился
     */
    private executeHandlers(context: PacketContext, _packet: IIncomingPacket): boolean {
        const { opcode, state } = context;

        // Находим подходящий обработчик
        for (const handler of this.handlers) {
            if (handler.canHandle(opcode, state)) {
                try {
                    // Создаем реальный PacketReader для чтения данных
                    // Пропускаем 1 байт (код операции), так как он уже известен
                    const reader = new PacketReader(context.rawBody, 1);
                    handler.handle(context, reader);
                    return true; // Обработчик успешно выполнен
                } catch (error) {
                    console.error(`Error in packet handler for opcode ${opcode}:`, error);
                }
            }
        }

        return false; // Ни один обработчик не выполнился
    }

    /**
     * Получить статистику
     */
    getStats(): {
        handlers: number;
        middlewares: number;
        supportedOpcodes: number[];
    } {
        return {
            handlers: this.handlers.length,
            middlewares: this.middlewares.length,
            supportedOpcodes: this.factory.getRegisteredOpcodes(),
        };
    }
}

/**
 * Базовая стратегия обработки пакета
 * Помогает создавать конкретные стратегии с type-safe подходом
 */
export abstract class BasePacketHandlerStrategy<T extends IIncomingPacket> implements IPacketHandlerStrategy {
    constructor(
        protected readonly opcode: number,
        protected readonly eventBus: IEventBus
    ) {}

    canHandle(opcode: number, state: string): boolean {
        return opcode === this.opcode && this.canHandleInState(state);
    }

    /**
     * Проверить можно ли обработать в данном состоянии
     */
    protected abstract canHandleInState(state: string): boolean;

    /**
     * Обработать пакет
     */
    abstract handle(context: PacketContext, reader: import('../../../application/ports').IPacketReader): void;

    /**
     * Получить декодированный пакет
     */
    protected decode(_reader: import('../../../application/ports').IPacketReader): T {
        // Переопределяется в наследниках
        throw new Error('Not implemented');
    }
}
