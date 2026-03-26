/**
 * @fileoverview WsServerNew - WebSocket сервер с новой архитектурой
 * Использует IEventBus вместо legacy EventBus
 * @module api/ws
 */

/// <reference types="ws" />
import type { WebSocket as WebSocketType, WebSocketServer as WebSocketServerType } from 'ws';
import ws = require('ws');
const WebSocketServer = ws.WebSocketServer;
const WebSocket = ws.WebSocket;
// import { parse } from 'url';  // Temporarily disabled
import type { IncomingMessage, Server } from 'http';
import { API_CONFIG } from '../../config';
import { Logger } from '../../logger/Logger';
import { getContainer } from '../../config/di/appContainer';
import { DI_TOKENS } from '../../config/di/Container';
import type { IEventBus } from '../../application/ports';
import type { IConnectionRepository } from '../../domain/repositories';
import { PacketBroadcastService, type WsPacketMessage } from '../../services/PacketBroadcastService';

/**
 * Configuration options for WsServer
 */
export interface WsServerOptions {
    port?: number;
    debug?: boolean;
}

interface WsClient {
    ws: WebSocketType;
    id: string;
    channels: Set<string>;
    isAlive: boolean;
}

interface SubscribeMessage {
    type: 'subscribe';
    channels: string[];
}

interface UnsubscribeMessage {
    type: 'unsubscribe';
    channels: string[];
}

interface PingMessage {
    type: 'ping';
}

type WsMessage = SubscribeMessage | UnsubscribeMessage | PingMessage;

/**
 * WebSocket сервер с новой архитектурой
 */
export class WsServerNew {
    private wss: WebSocketServerType | null = null;
    private clients: Map<WebSocketType, WsClient> = new Map();
    private pingInterval: NodeJS.Timeout | null = null;
    private options: WsServerOptions = {};
    private unsubscribeEventBus: (() => void) | null = null;
    private unsubscribePackets: (() => void) | null = null;

    /**
     * Start WebSocket server
     */
    start(server?: Server, options: WsServerOptions = {}): void {
        this.options = { port: 8080, debug: false, ...options };

        if (server) {
            this.wss = new WebSocketServer({
                server,
                verifyClient: (info: { req: IncomingMessage }) => this.verifyClient(info)
            });
            Logger.info('WsServer', `WebSocket server started in shared mode at ws://localhost:${API_CONFIG.port}/ws`);
        } else {
            this.wss = new WebSocketServer({
                port: this.options.port,
                verifyClient: (info: { req: IncomingMessage }) => this.verifyClient(info)
            });
            Logger.info('WsServer', `WebSocket server started in standalone mode at ws://localhost:${this.options.port}`);
        }

        this.wss.on('connection', this.handleConnection.bind(this));

        // Start ping/pong
        this.pingInterval = setInterval(() => {
            this.clients.forEach((client) => {
                if (!client.isAlive) {
                    client.ws.terminate();
                    this.clients.delete(client.ws);
                    return;
                }
                client.isAlive = false;
                client.ws.ping();
            });
        }, 30000);

        // Subscribe to EventBus (new architecture)
        this.subscribeToEventBus();

        // Subscribe to PacketBroadcastService for server packets
        this.subscribeToPackets();
    }

    /**
     * Subscribe to new architecture EventBus
     */
    private subscribeToEventBus(): void {
        const container = getContainer();
        const eventBus = container.resolve<IEventBus>(DI_TOKENS.EventBus).getOrThrow();

        const subscription = eventBus.subscribeAll((event: { type: string; channel?: string; payload: unknown; timestamp: Date }) => {
            this.broadcastEvent(event);
        });

        this.unsubscribeEventBus = () => subscription.unsubscribe();
    }

    /**
     * Subscribe to PacketBroadcastService for server packets
     */
    private subscribeToPackets(): void {
        const packetService = PacketBroadcastService.getInstance();

        const unsubscribe = packetService.subscribe((packet: WsPacketMessage) => {
            // Send to ALL connected clients (no channel filtering for packets)
            const message = {
                type: 'server_packet',
                channel: 'packets',
                payload: {
                    opcode: packet.opcode,
                    opcodeHex: packet.opcodeHex,
                    name: packet.name,
                    data: packet.data,
                    direction: packet.direction
                },
                timestamp: new Date(packet.timestamp)
            };

            this.broadcast(message);
        });

        this.unsubscribePackets = unsubscribe;
    }

    /**
     * Broadcast any JSON data to all connected WebSocket clients
     */
    broadcast(data: Record<string, unknown>): void {
        const message = JSON.stringify(data);
        let sentCount = 0;

        this.clients.forEach((client) => {
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(message);
                sentCount++;
            }
        });

        if (this.options.debug) {
            Logger.debug('WsServer', `Broadcast sent to ${sentCount} clients: ${message.slice(0, 200)}...`);
        }
    }

    private verifyClient(_info: { req: IncomingMessage }): boolean {
        // API_KEY authentication temporarily disabled
        return true;

        /* Original authentication code - temporarily disabled
        if (!API_CONFIG.apiKey) {
            return true;
        }

        const { query } = parse(info.req.url || '', true);
        const token = query['token'] as string;

        if (!token || token !== API_CONFIG.apiKey) {
            Logger.warn('WsServer', 'WebSocket connection rejected: invalid token');
            return false;
        }

        return true;
        */
    }

    private handleConnection(ws: WebSocketType, req: IncomingMessage): void {
        const clientId = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
        const client: WsClient = {
            ws,
            id: clientId,
            channels: new Set(),
            isAlive: true
        };

        this.clients.set(ws, client);
        Logger.info('WsServer', `Client connected: ${clientId}`);

        // Send welcome message
        this.sendToClient(client, {
            type: 'system.connected',
            channel: 'system',
            payload: {
                phase: 'WS_CONNECTED',
                characterName: `Connected to L2TS Event Stream (${clientId})`
            },
            timestamp: new Date()
        });

        // Send current connection phase
        const connectionRepo = getContainer().resolve<IConnectionRepository>(DI_TOKENS.ConnectionRepository).getOrThrow();
        const connectionState = connectionRepo.get();
        
        this.sendToClient(client, {
            type: 'connection.phase_changed',
            channel: 'system',
            payload: {
                phase: connectionState.phase,
                host: connectionState.host,
                port: connectionState.port
            },
            timestamp: new Date()
        });

        // Send buffered packets from PacketBroadcastService
        const packetService = PacketBroadcastService.getInstance();
        const bufferedPackets = packetService.getBufferedPackets();
        for (const packet of bufferedPackets) {
            this.sendToClient(client, {
                type: 'server_packet',
                channel: 'packets',
                payload: {
                    opcode: packet.opcode,
                    opcodeHex: packet.opcodeHex,
                    name: packet.name,
                    data: packet.data,
                    direction: packet.direction
                },
                timestamp: new Date(packet.timestamp)
            });
        }

        ws.on('message', (data: Buffer) => {
            this.handleMessage(client, data);
        });

        ws.on('pong', () => {
            client.isAlive = true;
        });

        ws.on('close', () => {
            Logger.info('WsServer', `Client disconnected: ${clientId}`);
            this.clients.delete(ws);
        });

        ws.on('error', (error: Error) => {
            Logger.error('WsServer', `WebSocket error for ${clientId}: ${error.message}`);
        });
    }

    private handleMessage(client: WsClient, data: Buffer): void {
        try {
            const message: WsMessage = JSON.parse(data.toString());

            switch (message.type) {
                case 'subscribe':
                    this.handleSubscribe(client, message.channels);
                    break;

                case 'unsubscribe':
                    this.handleUnsubscribe(client, message.channels);
                    break;

                case 'ping':
                    this.sendToClient(client, {
                        type: 'pong',
                        channel: 'system',
                        payload: {},
                        timestamp: new Date()
                    });
                    break;

                default:
                    this.sendToClient(client, {
                        type: 'system.error',
                        channel: 'system',
                        payload: {
                            code: 'INVALID_MESSAGE',
                            message: `Unknown message type: ${(message as { type: string }).type}`
                        },
                        timestamp: new Date()
                    });
            }
        } catch (error) {
            Logger.error('WsServer', `Failed to parse message: ${error}`);
            this.sendToClient(client, {
                type: 'system.error',
                channel: 'system',
                payload: {
                    code: 'INVALID_MESSAGE',
                    message: 'Invalid JSON message'
                },
                timestamp: new Date()
            });
        }
    }

    private handleSubscribe(client: WsClient, channels: string[]): void {
        const validChannels = ['system', 'character', 'combat', 'chat', 'world', 'movement', 'party', 'inventory'];

        for (const channel of channels) {
            if (validChannels.includes(channel)) {
                client.channels.add(channel);
            }
        }

        this.sendToClient(client, {
            type: 'system.subscribed',
            channel: 'system',
            payload: {
                channels: Array.from(client.channels)
            },
            timestamp: new Date()
        });

        Logger.debug('WsServer', `Client ${client.id} subscribed to: ${Array.from(client.channels).join(', ')}`);
    }

    private handleUnsubscribe(client: WsClient, channels: string[]): void {
        for (const channel of channels) {
            client.channels.delete(channel);
        }

        this.sendToClient(client, {
            type: 'system.unsubscribed',
            channel: 'system',
            payload: {
                channels: Array.from(client.channels)
            },
            timestamp: new Date()
        });
    }

    private sendToClient(client: WsClient, event: { type: string; channel: string; payload: unknown; timestamp: Date }): void {
        if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify({
                ...event,
                timestamp: event.timestamp.toISOString()
            }));
        }
    }

    private broadcastEvent(event: { type: string; channel?: string; payload: unknown; timestamp: Date }): void {
        // Determine channel from event type if not specified
        const channel = event.channel || this.getChannelForEvent(event.type);

        this.clients.forEach((client) => {
            if (client.channels.has(channel)) {
                this.sendToClient(client, {
                    type: event.type,
                    channel,
                    payload: event.payload,
                    timestamp: event.timestamp,
                });
            }
        });
    }

    private getChannelForEvent(eventType: string): string {
        if (eventType.startsWith('character.')) return 'character';
        if (eventType.startsWith('world.')) return 'world';
        if (eventType.startsWith('combat.')) return 'combat';
        if (eventType.startsWith('chat.')) return 'chat';
        if (eventType.startsWith('inventory.')) return 'inventory';
        if (eventType.startsWith('movement.')) return 'movement';
        if (eventType.startsWith('party.')) return 'party';
        return 'system';
    }

    /**
     * Get the number of connected clients
     */
    getClientCount(): number {
        return this.clients.size;
    }

    /**
     * Check if server is running
     */
    isRunning(): boolean {
        return this.wss !== null;
    }

    stop(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }

        if (this.unsubscribeEventBus) {
            this.unsubscribeEventBus();
        }

        if (this.unsubscribePackets) {
            this.unsubscribePackets();
            this.unsubscribePackets = null;
        }

        this.clients.forEach((client) => {
            client.ws.close();
        });
        this.clients.clear();

        if (this.wss) {
            this.wss.close();
        }

        Logger.info('WsServer', 'WebSocket server stopped');
    }
}
