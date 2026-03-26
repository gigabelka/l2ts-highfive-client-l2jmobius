/**
 * @fileoverview SessionManager - централизованное управление сессией Login Server
 * Хранит все данные сессии: SessionKey, PlayOk, выбранный сервер и персонаж
 * @module login/session
 */

import { EventEmitter } from 'events';
import type { ServerInfo } from '../packets/incoming/ServerListPacket';

/**
 * Ключи сессии Login Server (LoginOk)
 */
export interface LoginSessionKey {
    id1: number;
    id2: number;
}

/**
 * Ключи для входа на Game Server (PlayOk)
 */
export interface PlaySessionKey {
    id1: number;
    id2: number;
}

/**
 * Полные данные сессии
 */
export interface SessionData {
    /** ID сессии (из Init пакета) */
    sessionId: number;
    
    /** RSA публичный ключ (расшифрованный) */
    rsaPublicKey: Buffer;
    
    /** Ответ GGAuth */
    ggAuthResponse: number;
    
    /** LoginOk ключи */
    loginOk: LoginSessionKey;
    
    /** PlayOk ключи */
    playOk: PlaySessionKey;
    
    /** Выбранный игровой сервер */
    selectedServer: ServerInfo;
    
    /** IP и порт Game Server */
    gameServerIp: string;
    gameServerPort: number;
    
    /** Имя пользователя */
    username: string;
    
    /** Blowfish ключ */
    blowfishKey: Buffer;
}

/**
 * События сессии
 */
export type SessionEvent =
    | { type: 'session.init_received'; sessionId: number }
    | { type: 'session.gg_auth_completed'; response: number }
    | { type: 'session.login_ok_received'; keys: LoginSessionKey }
    | { type: 'session.server_selected'; server: ServerInfo }
    | { type: 'session.play_ok_received'; keys: PlaySessionKey }
    | { type: 'session.auth_failed'; reason: number; message: string }
    | { type: 'session.completed'; data: SessionData }
    | { type: 'session.reset' };

/**
 * Менеджер сессии - централизованное хранилище данных сессии
 * Паттерн: Singleton + EventEmitter
 */
export class SessionManager extends EventEmitter {
    private static instance: SessionManager | null = null;
    
    private data: Partial<SessionData> = {};
    private isComplete = false;
    
    private constructor() {
        super();
    }
    
    /**
     * Получить единственный экземпляр SessionManager
     */
    static getInstance(): SessionManager {
        if (!SessionManager.instance) {
            SessionManager.instance = new SessionManager();
        }
        return SessionManager.instance;
    }
    
    /**
     * Уничтожить экземпляр (для тестирования)
     */
    static destroy(): void {
        if (SessionManager.instance) {
            SessionManager.instance.removeAllListeners();
            SessionManager.instance = null;
        }
    }
    
    /**
     * Установить ID сессии и RSA ключ (из Init пакета)
     */
    setInitData(sessionId: number, rsaPublicKey: Buffer, blowfishKey: Buffer): void {
        this.data.sessionId = sessionId;
        this.data.rsaPublicKey = rsaPublicKey;
        this.data.blowfishKey = blowfishKey;
        
        this.emitSessionEvent({
            type: 'session.init_received',
            sessionId
        });
    }
    
    /**
     * Установить ответ GGAuth
     */
    setGgAuthResponse(response: number): void {
        this.data.ggAuthResponse = response;
        
        this.emitSessionEvent({
            type: 'session.gg_auth_completed',
            response
        });
    }
    
    /**
     * Установить LoginOk ключи
     */
    setLoginOk(id1: number, id2: number): void {
        this.data.loginOk = { id1, id2 };
        
        this.emitSessionEvent({
            type: 'session.login_ok_received',
            keys: { id1, id2 }
        });
    }
    
    /**
     * Выбрать сервер из списка
     */
    selectServer(serverId: number, servers: ServerInfo[]): ServerInfo | null {
        const server = servers.find(s => s.serverId === serverId);
        
        if (!server) {
            return null;
        }
        
        this.data.selectedServer = server;
        this.data.gameServerIp = server.ip;
        this.data.gameServerPort = server.port;
        
        this.emitSessionEvent({
            type: 'session.server_selected',
            server
        });
        
        return server;
    }
    
    /**
     * Установить PlayOk ключи (финальный шаг авторизации)
     */
    setPlayOk(id1: number, id2: number): void {
        this.data.playOk = { id1, id2 };
        
        this.emitSessionEvent({
            type: 'session.play_ok_received',
            keys: { id1, id2 }
        });
        
        // Проверяем полноту сессии
        this.checkComplete();
    }
    
    /**
     * Уведомить об ошибке авторизации
     */
    setAuthFailed(reason: number, message: string): void {
        this.emitSessionEvent({
            type: 'session.auth_failed',
            reason,
            message
        });
    }
    
    /**
     * Установить имя пользователя
     */
    setUsername(username: string): void {
        this.data.username = username;
    }
    
    /**
     * Получить полные данные сессии
     */
    getSessionData(): Partial<SessionData> {
        return { ...this.data };
    }
    
    /**
     * Получить ID сессии
     */
    getSessionId(): number | undefined {
        return this.data.sessionId;
    }
    
    /**
     * Получить RSA публичный ключ
     */
    getRsaPublicKey(): Buffer | undefined {
        return this.data.rsaPublicKey;
    }
    
    /**
     * Получить LoginOk ключи
     */
    getLoginOk(): LoginSessionKey | undefined {
        return this.data.loginOk;
    }
    
    /**
     * Получить PlayOk ключи
     */
    getPlayOk(): PlaySessionKey | undefined {
        return this.data.playOk;
    }
    
    /**
     * Получить выбранный сервер
     */
    getSelectedServer(): ServerInfo | undefined {
        return this.data.selectedServer;
    }
    
    /**
     * Получить Blowfish ключ
     */
    getBlowfishKey(): Buffer | undefined {
        return this.data.blowfishKey;
    }
    
    /**
     * Проверить, завершена ли сессия (есть все необходимые данные)
     */
    isSessionComplete(): boolean {
        return this.isComplete;
    }
    
    /**
     * Проверить и отметить сессию как завершенную
     */
    private checkComplete(): void {
        const required = [
            this.data.sessionId,
            this.data.rsaPublicKey,
            this.data.ggAuthResponse !== undefined,
            this.data.loginOk,
            this.data.playOk,
            this.data.selectedServer,
            this.data.username
        ];
        
        if (required.every(Boolean)) {
            this.isComplete = true;
            this.emitSessionEvent({
                type: 'session.completed',
                data: this.data as SessionData
            });
        }
    }
    
    /**
     * Сбросить сессию
     */
    reset(): void {
        this.data = {};
        this.isComplete = false;
        
        this.emitSessionEvent({
            type: 'session.reset'
        });
    }
    
    /**
     * Подписаться на события сессии
     */
    subscribe<T extends SessionEvent>(
        eventType: T['type'],
        callback: (event: T) => void
    ): () => void {
        const handler = (event: SessionEvent) => {
            if (event.type === eventType) {
                callback(event as T);
            }
        };
        
        super.on('session.event', handler);
        
        return () => {
            super.off('session.event', handler);
        };
    }
    
    /**
     * Эмитировать событие сессии
     */
    private emitSessionEvent(event: SessionEvent): void {
        super.emit('session.event', event);
    }
}

/**
 * Хук для удобного доступа к SessionManager
 */
export function useSession(): SessionManager {
    return SessionManager.getInstance();
}
