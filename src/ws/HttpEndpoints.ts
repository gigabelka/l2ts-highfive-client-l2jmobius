/**
 * @fileoverview HttpEndpoints - HTTP эндпоинты для снимков GameState
 * @module ws/HttpEndpoints
 *
 * Простые HTTP GET эндпоинты для разового запроса данных.
 * Использует встроенный http модуль Node.js (без express).
 * Работает на том же порту что и WebSocket (shared HTTP server).
 */

import type { IncomingMessage, Server, ServerResponse } from 'http';
import type { GameState } from '../game/GameState';
import { extractToken, validateToken } from './auth';
import { Logger } from '../logger/Logger';

/**
 * Конфигурация HTTP эндпоинтов
 */
export interface HttpEndpointsConfig {
    /** Включена ли авторизация */
    authEnabled: boolean;
    /** Список валидных токенов */
    authTokens: string[];
}

/**
 * HTTP эндпоинты для доступа к GameState
 */
export class HttpEndpoints {
    private gameState: GameState;
    private config: HttpEndpointsConfig;
    private startTime: number = Date.now();
    private requestCount: number = 0;

    /**
     * Создаёт HTTP эндпоинты
     * @param gameState - GameState для доступа к данным
     * @param config - конфигурация авторизации
     */
    constructor(gameState: GameState, config: HttpEndpointsConfig) {
        this.gameState = gameState;
        this.config = config;
    }

    /**
     * Привязывает обработчики к HTTP серверу
     * @param server - HTTP сервер (shared с WebSocket)
     */
    attach(server: Server): void {
        // Добавляем обработчик запросов
        server.on('request', this.handleRequest.bind(this));

        Logger.info('HttpEndpoints', 'HTTP endpoints attached to server');
    }

    /**
     * Обработчик HTTP запросов
     */
    private handleRequest(req: IncomingMessage, res: ServerResponse): void {
        // Увеличиваем счётчик запросов
        this.requestCount++;

        // Устанавливаем CORS заголовки
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Content-Type', 'application/json');

        // Обработка OPTIONS (preflight)
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        // Разрешаем только GET
        if (req.method !== 'GET') {
            this.sendError(res, 405, 'Method Not Allowed', 'Only GET method is supported');
            return;
        }

        // Проверяем авторизацию если включена
        if (this.config.authEnabled) {
            const token = extractToken(req);
            if (!token || !validateToken(token, this.config.authTokens)) {
                Logger.warn('HttpEndpoints', `Unauthorized request from ${req.socket.remoteAddress}`);
                this.sendError(res, 401, 'Unauthorized', 'Invalid or missing token');
                return;
            }
        }

        // Маршрутизация
        const url = req.url || '/';

        switch (url) {
            case '/api/v1/snapshot':
                this.handleSnapshot(res);
                break;
            case '/api/v1/me':
                this.handleMe(res);
                break;
            case '/api/v1/players':
                this.handlePlayers(res);
                break;
            case '/api/v1/npcs':
                this.handleNpcs(res);
                break;
            case '/api/v1/inventory':
                this.handleInventory(res);
                break;
            case '/api/v1/chat':
                this.handleChat(res);
                break;
            case '/api/v1/stats':
                this.handleStats(res);
                break;
            case '/api/v1/health':
                this.handleHealth(res);
                break;
            default:
                this.sendError(res, 404, 'Not Found', `Endpoint ${url} not found`);
        }
    }

    /**
     * GET /api/v1/snapshot - полный снимок GameState
     */
    private handleSnapshot(res: ServerResponse): void {
        const snapshot = this.gameState.getSnapshot();
        this.sendJson(res, 200, snapshot);
    }

    /**
     * GET /api/v1/me - данные моего персонажа
     */
    private handleMe(res: ServerResponse): void {
        this.sendJson(res, 200, {
            me: this.gameState.me,
        });
    }

    /**
     * GET /api/v1/players - список видимых игроков
     */
    private handlePlayers(res: ServerResponse): void {
        this.sendJson(res, 200, {
            players: Array.from(this.gameState.players.values()),
            count: this.gameState.players.size,
        });
    }

    /**
     * GET /api/v1/npcs - список видимых NPC
     */
    private handleNpcs(res: ServerResponse): void {
        this.sendJson(res, 200, {
            npcs: Array.from(this.gameState.npcs.values()),
            count: this.gameState.npcs.size,
        });
    }

    /**
     * GET /api/v1/inventory - инвентарь
     */
    private handleInventory(res: ServerResponse): void {
        this.sendJson(res, 200, {
            inventory: Array.from(this.gameState.inventory.values()),
            count: this.gameState.inventory.size,
        });
    }

    /**
     * GET /api/v1/chat - последние 50 сообщений чата
     */
    private handleChat(res: ServerResponse): void {
        // GameState.getSnapshot() уже возвращает последние 50 сообщений
        // Но здесь мы берём напрямую из массива chat
        const messages = this.gameState.chat.slice(-50);
        this.sendJson(res, 200, {
            messages,
            count: messages.length,
        });
    }

    /**
     * GET /api/v1/stats - статистика WS-сервера
     */
    private handleStats(res: ServerResponse): void {
        const uptime = Date.now() - this.startTime;
        const wsClients = this.getWsClientCount();

        this.sendJson(res, 200, {
            clientsOnline: wsClients,
            uptime,
            uptimeFormatted: this.formatUptime(uptime),
            totalRequests: this.requestCount,
            gameState: {
                meInitialized: this.gameState.me !== null,
                playersCount: this.gameState.players.size,
                npcsCount: this.gameState.npcs.size,
                itemsCount: this.gameState.items.size,
                inventoryCount: this.gameState.inventory.size,
                skillsCount: this.gameState.skills.length,
                partyCount: this.gameState.party.length,
                chatCount: this.gameState.chat.length,
                effectsCount: this.gameState.effects.length,
            },
        });
    }

    /**
     * GET /api/v1/health - health check
     */
    private handleHealth(res: ServerResponse): void {
        this.sendJson(res, 200, {
            status: 'ok',
            gameConnected: this.gameState.me !== null,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Отправляет JSON ответ
     */
    private sendJson(res: ServerResponse, status: number, data: unknown): void {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data, null, 2));
    }

    /**
     * Отправляет ошибку
     */
    private sendError(res: ServerResponse, status: number, code: string, message: string): void {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: {
                code,
                message,
            },
            timestamp: new Date().toISOString(),
        }, null, 2));
    }

    /**
     * Форматирует uptime в читаемый вид
     */
    private formatUptime(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
        }
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        }
        if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        return `${seconds}s`;
    }

    /**
     * Получает количество WebSocket клиентов
     * Этот метод будет переопределён из WsApiServer
     */
    private getWsClientCount(): number {
        // Будет обновлено через setter из WsApiServer
        return 0;
    }

    /**
     * Устанавливает функцию для получения количества WS клиентов
     */
    setWsClientCountGetter(getter: () => number): void {
        this.getWsClientCount = getter;
    }
}

export default HttpEndpoints;
