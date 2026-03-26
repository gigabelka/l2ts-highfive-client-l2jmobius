/**
 * @fileoverview IConnection - порт для TCP соединения
 * @module application/ports
 */

import type { Result } from '../../shared/result';

export interface ConnectionConfig {
    host: string;
    port: number;
    timeout?: number;
}

export interface ConnectionState {
    isConnected: boolean;
    host: string;
    port: number;
    bytesSent: number;
    bytesReceived: number;
    connectedAt?: Date;
}

export type ConnectionStatus = 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

/**
 * Ошибки соединения
 */
export class ConnectionError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly isRetryable: boolean = false
    ) {
        super(message);
        this.name = 'ConnectionError';
    }

    static notConnected(): ConnectionError {
        return new ConnectionError('Not connected', 'NOT_CONNECTED', false);
    }

    static connectFailed(host: string, port: number, reason: string): ConnectionError {
        return new ConnectionError(
            `Failed to connect to ${host}:${port}: ${reason}`,
            'CONNECT_FAILED',
            true
        );
    }

    static timeout(): ConnectionError {
        return new ConnectionError('Connection timeout', 'TIMEOUT', true);
    }

    static writeFailed(reason: string): ConnectionError {
        return new ConnectionError(`Write failed: ${reason}`, 'WRITE_FAILED', true);
    }
}

/**
 * Обработчик входящих пакетов
 */
export type PacketHandler = (data: Buffer) => void;

/**
 * Обработчик событий соединения
 */
export interface ConnectionHandlers {
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: ConnectionError) => void;
    onPacket?: PacketHandler;
}

/**
 * Порт для TCP соединения
 */
export interface IConnection {
    /**
     * Подключиться
     */
    connect(config: ConnectionConfig): Promise<Result<void, ConnectionError>>;

    /**
     * Отключиться
     */
    disconnect(): void;

    /**
     * Отправить данные
     */
    send(data: Buffer): Result<void, ConnectionError>;

    /**
     * Получить текущее состояние
     */
    getState(): ConnectionState;

    /**
     * Получить статус
     */
    getStatus(): ConnectionStatus;

    /**
     * Установить обработчики
     */
    setHandlers(handlers: ConnectionHandlers): void;

    /**
     * Проверить подключен ли
     */
    isConnected(): boolean;
}
