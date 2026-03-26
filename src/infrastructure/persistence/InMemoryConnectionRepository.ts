/**
 * @fileoverview InMemoryConnectionRepository - реализация репозитория подключения в памяти
 * @module infrastructure/persistence
 */

import {
    IConnectionRepository,
    ConnectionPhase,
    type ConnectionState,
} from '../../domain/repositories/IConnectionRepository';

/**
 * Реализация IConnectionRepository для хранения состояния в памяти
 */
export class InMemoryConnectionRepository implements IConnectionRepository {
    private state: ConnectionState;
    private startTime: number;

    constructor() {
        this.startTime = Date.now();
        this.state = this.getDefaultState();
    }

    get(): ConnectionState {
        // Обновляем uptime перед возвратом
        return {
            ...this.state,
            uptime: Date.now() - this.startTime,
        };
    }

    update(data: Partial<ConnectionState>): void {
        this.state = {
            ...this.state,
            ...data,
            lastActivity: new Date(),
        };
        
        // Если перешли в IN_GAME или обратно, сбрасываем время старта для uptime?
        // На самом деле uptime обычно считается с момента начала сессии.
    }

    setPhase(phase: ConnectionPhase, options?: { error?: string }): void {
        this.update({ phase, error: options?.error });

        // Если переходим из DISCONNECTED в процесс подключения, сбрасываем startTime
        if (phase === ConnectionPhase.LOGIN_CONNECTING) {
            this.startTime = Date.now();
        }
    }

    reset(): void {
        this.state = this.getDefaultState();
        this.startTime = Date.now();
    }

    private getDefaultState(): ConnectionState {
        return {
            phase: ConnectionPhase.DISCONNECTED,
            host: '',
            port: 0,
            uptime: 0,
            lastActivity: new Date(),
        };
    }
}

// Singleton exports удалены - используйте DI контейнер для получения инстансов
// Пример: container.resolve<IConnectionRepository>(DI_TOKENS.ConnectionRepository)
