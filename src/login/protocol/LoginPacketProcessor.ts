/**
 * @fileoverview LoginPacketProcessor - процессор пакетов Login Server
 * Координирует фабрику пакетов и стратегии обработки
 * Паттерны: Strategy + Chain of Responsibility
 * @module login/protocol
 */

import type {
    IPacketHandlerStrategy,
    PacketContext,
    PacketResult,
    IIncomingPacket,
    IPacketReader,
} from '../../application/ports';
import type { LoginIncomingPacketFactory } from './LoginIncomingPacketFactory';
import type { SessionManager } from '../session/SessionManager';

/**
 * Middleware для обработки пакетов
 */
export type LoginPacketMiddleware = (
    context: PacketContext,
    packet: IIncomingPacket | null,
    next: () => void
) => void;

/**
 * Расширенный контекст для Login Server
 */
export interface LoginPacketContext extends PacketContext {
    /** Текущее состояние Login FSM */
    loginState: string;
    /** Session Manager для доступа к данным сессии */
    sessionManager: SessionManager;
}

/**
 * Результат обработки Login пакета
 */
export interface LoginPacketResult extends PacketResult {
    /** Действие, которое нужно выполнить после обработки */
    action?: LoginPacketAction;
}

/**
 * Действие после обработки пакета
 */
export type LoginPacketAction =
    | { type: 'send_packet'; packet: Buffer }
    | { type: 'disconnect' }
    | { type: 'transition_state'; newState: string }
    | { type: 'auth_complete'; sessionData: unknown }
    | { type: 'auth_failed'; reason: number; message: string }
    | { type: 'none' };

/**
 * Процессор пакетов Login Server
 * Соединяет Factory и Strategy паттерны
 */
export class LoginPacketProcessor {
    private handlers: IPacketHandlerStrategy[] = [];
    private middlewares: LoginPacketMiddleware[] = [];
    private stats = new Map<number, { received: number; decoded: number; errors: number }>();

    constructor(
        private factory: LoginIncomingPacketFactory,
        private sessionManager: SessionManager
    ) {}

    /**
     * Регистрация стратегии обработки
     * @param handler - Стратегия обработки пакета
     */
    registerHandler(handler: IPacketHandlerStrategy): void {
        this.handlers.push(handler);
    }

    /**
     * Регистрация middleware
     * @param middleware - Middleware функция
     */
    use(middleware: LoginPacketMiddleware): this {
        this.middlewares.push(middleware);
        return this;
    }

    /**
     * Обработать пакет
     * @param opcode - Опкод пакета
     * @param data - Данные пакета (без заголовка длины)
     * @param state - Текущее состояние FSM
     * @returns Результат обработки
     */
    process(opcode: number, data: Buffer, state: string): LoginPacketResult {
        const context: LoginPacketContext = {
            opcode,
            state,
            loginState: state,
            timestamp: Date.now(),
            rawBody: data,
            sessionManager: this.sessionManager,
        };

        this.updateStats(opcode, 'received');

        // Проверяем поддержку опкода
        if (!this.factory.supports(opcode)) {
            return {
                success: false,
                error: `Unknown opcode: 0x${opcode.toString(16).padStart(2, '0')}`,
                context,
                action: { type: 'none' },
            };
        }

        // Создаем пакет через фабрику
        const createResult = this.factory.create(opcode);
        if (createResult.isErr()) {
            this.updateStats(opcode, 'error');
            return {
                success: false,
                error: createResult.error?.message || 'Unknown error',
                context,
                action: { type: 'none' },
            };
        }

        const packet = createResult.getOrThrow();

        // Выполняем middleware chain
        let middlewareError: Error | undefined;
        let handlerExecuted = false;

        const executeMiddleware = (index: number): void => {
            if (index < this.middlewares.length) {
                const mw = this.middlewares[index];
                if (mw) {
                    try {
                        mw(context, packet, () => executeMiddleware(index + 1));
                    } catch (error) {
                        middlewareError = error instanceof Error ? error : new Error(String(error));
                    }
                }
            } else {
                // После всех middleware выполняем обработчики
                handlerExecuted = this.executeHandlers(context, packet);
            }
        };

        executeMiddleware(0);

        if (middlewareError) {
            this.updateStats(opcode, 'error');
            return {
                success: false,
                error: `Middleware error: ${middlewareError.message}`,
                context,
                action: { type: 'none' },
            };
        }

        this.updateStats(opcode, 'decoded');

        return {
            success: true,
            packet,
            handlerExecuted,
            context,
            action: this.determineAction(context, packet),
        };
    }

    /**
     * Выполнить стратегии обработки
     * @returns true если хотя бы один обработчик выполнился
     */
    private executeHandlers(context: LoginPacketContext, packet: IIncomingPacket): boolean {
        const { opcode, state } = context;

        // Декодируем пакет сначала (для использования в handlePacket)
        try {
            const reader: IPacketReader = this.createReader(context.rawBody);
            packet.decode(reader, state);
        } catch (error) {
            console.error(`Error decoding packet ${opcode}:`, error);
        }

        // Находим подходящий обработчик
        for (const handler of this.handlers) {
            if (handler.canHandle(opcode, state)) {
                try {
                    // Создаем reader из raw данных (свежий reader для handler)
                    const reader: IPacketReader = this.createReader(context.rawBody);
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
     * Создать reader из буфера
     * Использует существующий PacketReader из login/packets
     */
    private createReader(buffer: Buffer): IPacketReader {
        // Импортируем динамически чтобы избежать circular dependency
        const { PacketReader } = require('../packets/incoming/IncomingLoginPacket');
        return new PacketReader(buffer) as IPacketReader;
    }

    /**
     * Определить действие после обработки
     */
    private determineAction(_context: LoginPacketContext, _packet: IIncomingPacket): LoginPacketAction {
        // Этот метод может быть расширен для автоматического определения действий
        // на основе типа пакета и текущего состояния
        return { type: 'none' };
    }

    /**
     * Обновить статистику
     */
    private updateStats(opcode: number, type: 'received' | 'decoded' | 'error'): void {
        let stat = this.stats.get(opcode);
        if (!stat) {
            stat = { received: 0, decoded: 0, errors: 0 };
            this.stats.set(opcode, stat);
        }

        if (type === 'received') {
            stat.received++;
        } else if (type === 'decoded') {
            stat.decoded++;
        } else if (type === 'error') {
            stat.errors++;
        }
    }

    /**
     * Получить статистику
     */
    getStats(): {
        handlers: number;
        middlewares: number;
        supportedOpcodes: number[];
        packetStats: Map<number, { received: number; decoded: number; errors: number }>;
    } {
        return {
            handlers: this.handlers.length,
            middlewares: this.middlewares.length,
            supportedOpcodes: this.factory.getRegisteredOpcodes(),
            packetStats: new Map(this.stats),
        };
    }

    /**
     * Сбросить статистику
     */
    resetStats(): void {
        this.stats.clear();
    }
}

/**
 * Базовая стратегия обработки пакета Login Server
 * Помогает создавать конкретные стратегии с type-safe подходом
 */
export abstract class BaseLoginPacketHandler<T extends IIncomingPacket> implements IPacketHandlerStrategy {
    constructor(
        protected readonly opcode: number,
        protected readonly sessionManager: SessionManager
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
    abstract handle(context: LoginPacketContext, reader: IPacketReader): void;

    /**
     * Декодировать пакет
     */
    protected decode(reader: IPacketReader): T {
        const packet = this.createPacket();
        packet.decode(reader);
        return packet as T;
    }

    /**
     * Создать экземпляр пакета
     */
    protected abstract createPacket(): T;
}
