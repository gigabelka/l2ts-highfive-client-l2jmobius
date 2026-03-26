/**
 * @fileoverview WsApiServer - WebSocket API сервер, транслирующий GameState наружу
 * @module ws/WsServer
 *
 * WebSocket сервер для трансляции игрового состояния в реальном времени.
 * Поддерживает подписку на каналы, авторизацию и отправку снапшотов состояния.
 * Оптимизации: throttling для move событий, батчинг событий.
 * 
 * HTTP эндпоинты для снимков работают на том же порту (shared HTTP server).
 */

import type { WebSocket as WebSocketType, WebSocketServer as WebSocketServerType } from 'ws';
import ws = require('ws');
const WebSocketServer = ws.WebSocketServer;
const WebSocket = ws.WebSocket;
import type { IncomingMessage } from 'http';
import * as http from 'http';
import { GameState } from '../game/GameState';
import { validateToken, extractToken } from './auth';
import { Logger } from '../logger/Logger';
import { HttpEndpoints } from './HttpEndpoints';
import { PacketBroadcastService, type WsPacketMessage } from '../services/PacketBroadcastService';
import { WsAuditService } from '../services/WsAuditService';

/**
 * Конфигурация WebSocket сервера
 */
export interface WsConfig {
    /** Порт сервера (по умолчанию 3000) */
    port: number;
    /** Включена ли авторизация */
    authEnabled: boolean;
    /** Список валидных токенов авторизации */
    authTokens: string[];
    /** Максимальное количество клиентов */
    maxClients: number;
    /** Интервал батчинга событий в мс (0 = отключено, по умолчанию 50) */
    batchInterval: number;
    /** Throttling для move событий в мс (по умолчанию 100) */
    moveThrottleMs: number;
    /** Включить аудит доставки пакетов */
    debugAudit?: boolean;
}

/**
 * Конфигурация по умолчанию
 */
const DEFAULT_CONFIG: WsConfig = {
    port: 3000,
    authEnabled: false,
    authTokens: [],
    maxClients: 10,
    batchInterval: 50,
    moveThrottleMs: 100,
    debugAudit: false,
};

/**
 * Состояние клиента WebSocket
 */
interface ClientState {
    ws: WebSocketType;
    channels: Set<string>;
    authenticated: boolean;
}

/**
 * Статистика сервера
 */
export interface ServerStats {
    clientsOnline: number;
    uptime: number;
    eventsPerSecond: number;
    droppedMoveEvents: number;
    totalEventsSent: number;
}

/**
 * Welcome сообщение
 */
interface WelcomeData {
    version: string;
    clientsOnline: number;
}

/**
 * WebSocket событие
 */
interface WsEvent<T = unknown> {
    type: string;
    ts: number;
    data: T;
}

/**
 * Расширенное событие с поддержкой direction (для пакетов)
 */
interface WsPacketEvent extends WsEvent<unknown> {
    direction?: 'server_to_client' | 'client_to_server';
    opcode: number;
    opcodeHex: string;
    name: string;
}

/**
 * Батч событий
 */
interface BatchEvent {
    type: 'batch';
    ts: number;
    events: WsEvent[];
}

/**
 * WebSocket API сервер для трансляции GameState
 * HTTP эндпоинты доступны на том же порту
 */
export class WsApiServer {
    private wss: WebSocketServerType | null = null;
    private httpServer: http.Server | null = null;
    private clients: Map<WebSocketType, ClientState> = new Map();
    private config: WsConfig;
    private state: GameState;
    private startTime: number = Date.now();
    private boundBroadcast: (event: WsEvent) => void;
    private httpEndpoints: HttpEndpoints;
    private packetBroadcast: PacketBroadcastService;

    // Throttling для move событий
    private lastMoveTime: Map<number, number> = new Map(); // objectId -> timestamp

    // Батчинг событий
    private eventBuffer: WsEvent[] = [];
    private batchTimer: NodeJS.Timeout | null = null;

    // Метрики
    private eventCountWindow: number[] = []; // Метрики за последние 10 секунд
    private droppedMoveEvents: number = 0;
    private totalEventsSent: number = 0;
    private readonly METRICS_WINDOW_MS = 10000; // 10 секунд окно

    // Отписка от broadcast service
    private unsubscribePackets: (() => void) | null = null;

    /**
     * Создаёт WebSocket сервер с HTTP эндпоинтами
     * @param state - GameState для трансляции
     * @param config - конфигурация сервера
     */
    constructor(state: GameState, config: Partial<WsConfig> = {}) {
        this.state = state;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.boundBroadcast = this.broadcast.bind(this);
        this.packetBroadcast = PacketBroadcastService.getInstance();
        
        // Обновляем дефолтный конфиг для debugAudit
        if (config.debugAudit !== undefined) {
            this.config.debugAudit = config.debugAudit;
        }

        // Создаём HTTP сервер
        this.httpServer = http.createServer();

        // Создаём WebSocket сервер поверх HTTP сервера
        this.wss = new WebSocketServer({
            server: this.httpServer,
        });

        // Создаём HTTP эндпоинты
        this.httpEndpoints = new HttpEndpoints(state, {
            authEnabled: this.config.authEnabled,
            authTokens: this.config.authTokens,
        });

        // Привязываем HTTP эндпоинты к серверу
        this.httpEndpoints.attach(this.httpServer);

        // Устанавливаем getter для количества клиентов
        this.httpEndpoints.setWsClientCountGetter(() => this.clients.size);

        // Подписываемся на события от GameState
        this.state.on('ws:event', this.boundBroadcast);

        // Подписываемся на пакеты от PacketBroadcastService
        this.unsubscribePackets = this.packetBroadcast.subscribe((packet) => {
            this.broadcastPacket(packet);
        });

        // Настраиваем обработку подключений WebSocket
        this.wss.on('connection', this.onConnect.bind(this));

        // Запускаем HTTP сервер
        this.httpServer.listen(this.config.port, () => {
            Logger.info('WsApiServer', `Server started on port ${this.config.port}`);
            Logger.info('WsApiServer', `WebSocket: ws://localhost:${this.config.port}`);
            Logger.info('WsApiServer', `HTTP endpoints: http://localhost:${this.config.port}/api/v1/{snapshot|me|players|npcs|inventory|chat|stats|health}`);
        });

        // Запускаем таймер метрик
        this.startMetricsTimer();

        // Инициализируем аудит если включен
        if (config.debugAudit) {
            WsAuditService.getInstance().enable();
        }

        // Логируем конфигурацию
        if (this.config.batchInterval > 0) {
            Logger.info('WsApiServer', `Batching enabled: ${this.config.batchInterval}ms`);
        }
        Logger.info('WsApiServer', `Move throttle: ${this.config.moveThrottleMs}ms`);
    }

    /**
     * Запускает таймер для обновления метрик
     */
    private startMetricsTimer(): void {
        setInterval(() => {
            // Очищаем старые метрики (старше 10 секунд)
            const cutoff = Date.now() - this.METRICS_WINDOW_MS;
            this.eventCountWindow = this.eventCountWindow.filter(ts => ts > cutoff);
        }, 1000);
    }

    /**
     * Проверяет, нужно ли throttle событие move
     * @param objectId - ID объекта
     * @returns true если событие нужно пропустить
     */
    private shouldThrottleMove(objectId: number): boolean {
        const now = Date.now();
        const lastTime = this.lastMoveTime.get(objectId);

        if (lastTime !== undefined && now - lastTime < this.config.moveThrottleMs) {
            return true;
        }

        this.lastMoveTime.set(objectId, now);
        return false;
    }

    /**
     * Обработчик нового подключения
     * @param ws - WebSocket клиента
     * @param request - HTTP запрос апгрейда
     */
    private onConnect(ws: WebSocketType, request: IncomingMessage): void {
        // Проверяем лимит клиентов
        if (this.clients.size >= this.config.maxClients) {
            ws.close(1013, 'Max clients exceeded'); // 1013 = Try Again Later
            return;
        }

        // Проверяем аутентификацию если включена
        let authenticated = !this.config.authEnabled;
        if (this.config.authEnabled) {
            const token = extractToken(request);
            if (token && validateToken(token, this.config.authTokens)) {
                authenticated = true;
            } else {
                // Логируем неудачную попытку аутентификации
                const clientIp = request.socket.remoteAddress || 'unknown';
                Logger.warn('WsAuth', `Authentication failed for client ${clientIp}: invalid or missing token`);
                ws.close(4001, 'Unauthorized');
                return;
            }
        }

        // Создаём состояние клиента с подпиской на все каналы по умолчанию
        const clientState: ClientState = {
            ws,
            channels: new Set(['*']),
            authenticated,
        };
        this.clients.set(ws, clientState);

        // Отправляем welcome сообщение
        const welcomeEvent: WsEvent<WelcomeData> = {
            type: 'welcome',
            ts: Date.now(),
            data: {
                version: '1.0',
                clientsOnline: this.clients.size,
            },
        };
        this.sendToClient(ws, welcomeEvent);

        // Отправляем накопленные пакеты из ring buffer (если клиент подписан на 'packets')
        if (clientState.channels.has('*') || clientState.channels.has('packets')) {
            this.sendBufferedPackets(ws);
        }

        // Отправляем снапшот состояния
        this.sendSnapshot(ws);

        // Настраиваем обработчики сообщений
        ws.on('message', (raw: Buffer) => this.onMessage(clientState, raw));
        ws.on('close', () => this.onDisconnect(ws));
        ws.on('error', (error: Error) => this.onError(ws, error));
    }

    /**
     * Обработчик сообщений от клиента
     * @param client - состояние клиента
     * @param raw - raw данные сообщения
     */
    private onMessage(client: ClientState, raw: Buffer): void {
        // Проверяем аутентификацию
        if (!client.authenticated) {
            this.sendToClient(client.ws, {
                type: 'error',
                ts: Date.now(),
                data: { message: 'Unauthorized' },
            });
            return;
        }

        try {
            const message = JSON.parse(raw.toString()) as { type: string };

            switch (message.type) {
                case 'subscribe':
                    this.handleSubscribe(client, message as { type: 'subscribe'; channels: string[] });
                    break;

                case 'unsubscribe':
                    this.handleUnsubscribe(client, message as { type: 'unsubscribe'; channels: string[] });
                    break;

                case 'get.snapshot':
                    this.sendSnapshot(client.ws);
                    break;

                case 'get.me':
                    this.sendToClient(client.ws, {
                        type: 'me',
                        ts: Date.now(),
                        data: this.state.me,
                    });
                    break;

                case 'get.players':
                    this.sendToClient(client.ws, {
                        type: 'players',
                        ts: Date.now(),
                        data: Array.from(this.state.players.values()),
                    });
                    break;

                case 'get.npcs':
                    this.sendToClient(client.ws, {
                        type: 'npcs',
                        ts: Date.now(),
                        data: Array.from(this.state.npcs.values()),
                    });
                    break;

                case 'get.inventory':
                    this.sendToClient(client.ws, {
                        type: 'inventory',
                        ts: Date.now(),
                        data: Array.from(this.state.inventory.values()),
                    });
                    break;

                case 'get.party':
                    this.sendToClient(client.ws, {
                        type: 'party',
                        ts: Date.now(),
                        data: this.state.party,
                    });
                    break;

                case 'get.effects':
                    this.sendToClient(client.ws, {
                        type: 'effects',
                        ts: Date.now(),
                        data: this.state.effects,
                    });
                    break;

                case 'get.skills':
                    this.sendToClient(client.ws, {
                        type: 'skills',
                        ts: Date.now(),
                        data: this.state.skills,
                    });
                    break;

                case 'get.stats':
                    this.sendToClient(client.ws, {
                        type: 'stats',
                        ts: Date.now(),
                        data: this.getStats(),
                    });
                    break;

                case 'get_audit_stats':
                    this.sendToClient(client.ws, {
                        type: 'audit_stats',
                        ts: Date.now(),
                        data: WsAuditService.getInstance().getStats(),
                    });
                    break;

                case 'ping':
                    this.sendToClient(client.ws, {
                        type: 'pong',
                        ts: Date.now(),
                        data: null,
                    });
                    break;

                default:
                    this.sendToClient(client.ws, {
                        type: 'error',
                        ts: Date.now(),
                        data: { message: `Unknown message type: ${message.type}` },
                    });
            }
        } catch {
            this.sendToClient(client.ws, {
                type: 'error',
                ts: Date.now(),
                data: { message: 'Invalid JSON message' },
            });
        }
    }

    /**
     * Обработка подписки на каналы
     * @param client - состояние клиента
     * @param message - сообщение подписки
     */
    private handleSubscribe(
        client: ClientState,
        message: { type: 'subscribe'; channels: string[] }
    ): void {
        const validChannels = [
            '*',
            'me',
            'players',
            'npcs',
            'items',
            'inventory',
            'combat',
            'chat',
            'party',
            'effects',
            'target',
            'movement',
            'skills',
            'packets', // Канал для сырых пакетов от сервера
        ];

        if (message.channels && Array.isArray(message.channels)) {
            for (const channel of message.channels) {
                if (validChannels.includes(channel)) {
                    client.channels.add(channel);
                }
            }
        }

        this.sendToClient(client.ws, {
            type: 'subscribed',
            ts: Date.now(),
            data: { channels: Array.from(client.channels) },
        });
    }

    /**
     * Обработка отписки от каналов
     * @param client - состояние клиента
     * @param message - сообщение отписки
     */
    private handleUnsubscribe(
        client: ClientState,
        message: { type: 'unsubscribe'; channels: string[] }
    ): void {
        if (message.channels && Array.isArray(message.channels)) {
            for (const channel of message.channels) {
                client.channels.delete(channel);
            }
        }

        this.sendToClient(client.ws, {
            type: 'unsubscribed',
            ts: Date.now(),
            data: { channels: Array.from(client.channels) },
        });
    }

    /**
     * Отправка снапшота состояния клиенту
     * @param ws - WebSocket клиента
     */
    private sendSnapshot(ws: WebSocketType): void {
        const snapshotEvent: WsEvent = {
            type: 'snapshot',
            ts: Date.now(),
            data: this.state.getSnapshot(),
        };
        this.sendToClient(ws, snapshotEvent);
    }

    /**
     * Отправка накопленных пакетов из ring buffer
     * @param ws - WebSocket клиента
     */
    private sendBufferedPackets(ws: WebSocketType): void {
        const bufferedPackets = this.packetBroadcast.getBufferedPackets();
        if (bufferedPackets.length === 0) {
            return;
        }

        Logger.info('WsApiServer', `Sending ${bufferedPackets.length} buffered packets to new client`);

        // Отправляем как батч
        const batchEvent: BatchEvent = {
            type: 'batch',
            ts: Date.now(),
            events: bufferedPackets.map(packet => ({
                type: packet.type,
                ts: packet.timestamp,
                data: packet.data,
                opcode: packet.opcode,
                opcodeHex: packet.opcodeHex,
                name: packet.name,
                direction: packet.direction,
            })),
        };

        this.sendToClient(ws, batchEvent);
        this.totalEventsSent += bufferedPackets.length;
    }

    /**
     * Broadcast пакета от сервера
     * @param packet - пакет для отправки
     */
    private broadcastPacket(packet: WsPacketMessage): void {
        const event: WsPacketEvent = {
            type: packet.type,
            ts: packet.timestamp,
            data: packet.data,
            opcode: packet.opcode,
            opcodeHex: packet.opcodeHex,
            name: packet.name,
            direction: packet.direction,
        };

        // Отправляем подписанным на 'packets' или '*'
        this.clients.forEach((client) => {
            if (!client.authenticated) {
                return;
            }
            if (client.channels.has('*') || client.channels.has('packets')) {
                this.sendToClient(client.ws, event);
                this.totalEventsSent++;
            }
        });
    }

    /**
     * Отправка сообщения клиенту
     * @param ws - WebSocket клиента
     * @param event - событие для отправки
     */
    private sendToClient(ws: WebSocketType, event: WsEvent | BatchEvent): void {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(event));
        }
    }

    /**
     * Broadcast события всем подписанным клиентам
     * @param event - событие для трансляции
     */
    private broadcast(event: WsEvent): void {
        // Отправляем только аутентифицированным клиентам

        // Throttling для move событий
        if (event.type === 'entity.move') {
            const objectId = (event.data as { objectId?: number })?.objectId;
            if (objectId !== undefined) {
                if (this.shouldThrottleMove(objectId)) {
                    this.droppedMoveEvents++;
                    return;
                }
            }
        }

        // Батчинг событий
        if (this.config.batchInterval > 0) {
            this.eventBuffer.push(event);
            this.scheduleBatchSend();
        } else {
            // Отправляем сразу
            this.sendEventToSubscribers(event);
        }
    }

    /**
     * Планирует отправку батча событий
     */
    private scheduleBatchSend(): void {
        if (this.batchTimer !== null) {
            return; // Таймер уже запущен
        }

        this.batchTimer = setTimeout(() => {
            this.flushBatch();
        }, this.config.batchInterval);
    }

    /**
     * Отправляет накопленные события батчем
     */
    private flushBatch(): void {
        if (this.eventBuffer.length === 0) {
            this.batchTimer = null;
            return;
        }

        const batch: BatchEvent = {
            type: 'batch',
            ts: Date.now(),
            events: this.eventBuffer.splice(0), // Очищаем буфер
        };

        this.batchTimer = null;

        // Отправляем батч всем подписанным клиентам
        const channel = this.getChannelForEvent(batch.events[0]?.type ?? 'unknown');

        this.clients.forEach((client) => {
            // Проверяем аутентификацию перед отправкой
            if (!client.authenticated) {
                return;
            }
            if (client.channels.has('*') || client.channels.has(channel)) {
                // Для батча проверяем подписку на каждое событие
                this.sendToClient(client.ws, batch);
                this.totalEventsSent += batch.events.length;
            }
        });

        // Обновляем метрики
        const now = Date.now();
        for (let i = 0; i < batch.events.length; i++) {
            this.eventCountWindow.push(now);
        }
    }

    /**
     * Отправляет событие подписанным клиентам
     * @param event - событие для отправки
     */
    private sendEventToSubscribers(event: WsEvent): void {
        const channel = this.getChannelForEvent(event.type);

        this.clients.forEach((client) => {
            // Проверяем аутентификацию перед отправкой
            if (!client.authenticated) {
                return;
            }
            if (client.channels.has('*') || client.channels.has(channel)) {
                this.sendToClient(client.ws, event);
                this.totalEventsSent++;
                this.eventCountWindow.push(Date.now());
            }
        });
    }

    /**
     * Определяет канал подписки из типа события
     * @param eventType - тип события (например, "player.appear")
     * @returns название канала подписки
     */
    private getChannelForEvent(eventType: string): string {
        const parts = eventType.split('.');
        const prefix = parts[0];

        if (prefix === undefined) {
            return '*';
        }

        const channelMap: Record<string, string> = {
            player: 'players',
            npc: 'npcs',
            item: 'items',
            entity: 'movement',
            status: 'target',
            me: 'me',
            chat: 'chat',
            combat: 'combat',
            party: 'party',
            effects: 'effects',
            target: 'target',
            inventory: 'inventory',
            skills: 'skills',
        };

        const channel = channelMap[prefix];
        if (channel !== undefined) {
            return channel;
        }
        return '*';
    }

    /**
     * Обработчик отключения клиента
     * @param ws - WebSocket клиента
     */
    private onDisconnect(ws: WebSocketType): void {
        this.clients.delete(ws);
    }

    /**
     * Обработчик ошибок WebSocket
     * @param ws - WebSocket клиента
     * @param error - объект ошибки
     */
    private onError(ws: WebSocketType, error: Error): void {
        console.error(`[WsApiServer] WebSocket error: ${error.message}`);
        this.clients.delete(ws);
    }

    /**
     * Возвращает статистику сервера
     * @returns объект с количеством клиентов и временем работы
     */
    getStats(): ServerStats {
        // Очищаем старые метрики
        const cutoff = Date.now() - this.METRICS_WINDOW_MS;
        this.eventCountWindow = this.eventCountWindow.filter(ts => ts > cutoff);

        // Вычисляем eventsPerSecond (скользящее среднее за 10 секунд)
        const eventsPerSecond = this.eventCountWindow.length / (this.METRICS_WINDOW_MS / 1000);

        return {
            clientsOnline: this.clients.size,
            uptime: Date.now() - this.startTime,
            eventsPerSecond: Math.round(eventsPerSecond * 100) / 100,
            droppedMoveEvents: this.droppedMoveEvents,
            totalEventsSent: this.totalEventsSent,
        };
    }

    /**
     * Останавливает сервер
     */
    stop(): void {
        // Отправляем оставшиеся события в батче
        if (this.config.batchInterval > 0 && this.eventBuffer.length > 0) {
            this.flushBatch();
        }

        // Отписываемся от событий GameState
        this.state.off('ws:event', this.boundBroadcast);

        // Отписываемся от пакетов
        if (this.unsubscribePackets) {
            this.unsubscribePackets();
            this.unsubscribePackets = null;
        }

        // Закрываем все соединения
        this.clients.forEach((client) => {
            client.ws.close();
        });
        this.clients.clear();

        // Очищаем таймер батчинга
        if (this.batchTimer !== null) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }

        // Очищаем throttle map
        this.lastMoveTime.clear();

        // Закрываем WebSocket сервер
        this.wss?.close();

        // Закрываем HTTP сервер
        this.httpServer?.close(() => {
            Logger.info('WsApiServer', 'HTTP server stopped');
        });

        Logger.info('WsApiServer', 'Stopped');
    }
}

export default WsApiServer;
