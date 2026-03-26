/**
 * @fileoverview IConnectionRepository - интерфейс для отслеживания состояния подключения
 * @module domain/repositories
 */

/**
 * Фазы подключения (соответствуют ожиданиям дашборда)
 */
export enum ConnectionPhase {
    DISCONNECTED = 'DISCONNECTED',
    LOGIN_CONNECTING = 'LOGIN_CONNECTING',
    LOGIN_AUTHENTICATING = 'LOGIN_AUTHENTICATING',
    SELECTING_CHARACTER = 'SELECTING_CHARACTER',
    ENTERING_GAME = 'ENTERING_GAME',
    IN_GAME = 'IN_GAME',
    WAITING_SERVER_SELECT = 'WAITING_SERVER_SELECT',
    ERROR = 'ERROR'
}

/**
 * Данные о состоянии подключения
 */
export interface ConnectionState {
    phase: ConnectionPhase;
    host: string;
    port: number;
    uptime: number; // в миллисекундах
    lastActivity: Date;
    error?: string;
}

/**
 * Репозиторий для управления состоянием подключения (Port)
 */
export interface IConnectionRepository {
    /**
     * Получить текущее состояние
     */
    get(): ConnectionState;

    /**
     * Обновить состояние
     */
    update(data: Partial<ConnectionState>): void;

    /**
     * Установить фазу
     */
    setPhase(phase: ConnectionPhase, options?: { error?: string }): void;

    /**
     * Сбросить состояние
     */
    reset(): void;
}

/**
 * Ошибки репозитория подключения
 */
export class ConnectionRepositoryError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ConnectionRepositoryError';
    }
}
