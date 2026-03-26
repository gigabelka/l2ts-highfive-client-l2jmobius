/**
 * @fileoverview WsServer Tests
 * @module __tests__/WsServer
 *
 * Тесты для WsApiServer - WebSocket сервера
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../game/GameState';
import { WsApiServer, WsConfig } from '../ws/WsServer';
import WebSocket from 'ws';
import { CharacterMe } from '../game/entities/types';

// Увеличиваем таймаут для WebSocket тестов
const WS_TIMEOUT = 5000;

describe('WsApiServer', () => {
    let state: GameState;
    let server: WsApiServer | null = null;
    const TEST_PORT = 3333;

    beforeEach(() => {
        state = new GameState();
    });

    afterEach(async () => {
        if (server) {
            server.stop();
            server = null;
        }
        // Ждем закрытия соединений
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    describe('Сервер стартует и принимает соединения', () => {
        it('сервер стартует на указанном порту', async () => {
            const config: WsConfig = {
                port: TEST_PORT,
                authEnabled: false,
                authTokens: [],
                maxClients: 10,
                batchInterval: 0, // Отключаем батчинг для тестов
                moveThrottleMs: 100,
            };

            server = new WsApiServer(state, config);

            // Ждем запуска сервера
            await new Promise(resolve => setTimeout(resolve, 100));

            // Проверяем что сервер отвечает на HTTP запрос
            const response = await fetch(`http://localhost:${TEST_PORT}/api/v1/health`);
            expect(response.status).toBe(200);

            const data = await response.json() as { status: string };
            expect(data.status).toBe('ok');
        });

        it('принимает WebSocket соединение', async () => {
            const config: WsConfig = {
                port: TEST_PORT + 1,
                authEnabled: false,
                authTokens: [],
                maxClients: 10,
                batchInterval: 0,
                moveThrottleMs: 100,
            };

            server = new WsApiServer(state, config);
            await new Promise(resolve => setTimeout(resolve, 100));

            const ws = new WebSocket(`ws://localhost:${TEST_PORT + 1}`);

            await new Promise<void>((resolve, reject) => {
                ws.on('open', () => {
                    ws.close();
                    resolve();
                });
                ws.on('error', reject);
                setTimeout(() => reject(new Error('Connection timeout')), WS_TIMEOUT);
            });

            expect(ws.readyState).toBe(WebSocket.CLOSING);
        });
    });

    describe('При подключении получаем welcome + snapshot', () => {
        it('отправляет welcome сообщение при подключении', async () => {
            const config: WsConfig = {
                port: TEST_PORT + 2,
                authEnabled: false,
                authTokens: [],
                maxClients: 10,
                batchInterval: 0,
                moveThrottleMs: 100,
            };

            server = new WsApiServer(state, config);
            await new Promise(resolve => setTimeout(resolve, 100));

            const ws = new WebSocket(`ws://localhost:${TEST_PORT + 2}`);

            const messages: Array<{ type: string }> = [];

            await new Promise<void>((resolve, reject) => {
                ws.on('message', (data) => {
                    const msg = JSON.parse(data.toString()) as { type: string };
                    messages.push(msg);
                    if (msg.type === 'welcome') {
                        ws.close();
                        resolve();
                    }
                });
                ws.on('error', reject);
                setTimeout(() => reject(new Error('Timeout waiting for welcome')), WS_TIMEOUT);
            });

            const welcome = messages.find(m => m.type === 'welcome');
            expect(welcome).toBeDefined();
            expect(welcome).toMatchObject({
                type: 'welcome',
                data: expect.objectContaining({
                    version: '1.0',
                    clientsOnline: expect.any(Number),
                }),
            });
        });

        it('отправляет snapshot после welcome', async () => {
            // Заполняем state данными
            const me: CharacterMe = {
                objectId: 12345,
                name: 'TestChar',
                title: '',
                classId: 92,
                className: 'Adventurer',
                level: 80,
                x: -80826,
                y: 149775,
                z: -3040,
                heading: 0,
                hp: 1000,
                maxHp: 1000,
                mp: 500,
                maxMp: 500,
                cp: 200,
                maxCp: 200,
                exp: 0,
                sp: 0,
                str: 40,
                dex: 35,
                con: 30,
                int: 21,
                wit: 20,
                men: 25,
                pAtk: 100,
                mAtk: 50,
                pDef: 100,
                mDef: 80,
                attackSpeed: 500,
                castSpeed: 300,
                runSpeed: 120,
                walkSpeed: 80,
                pvpFlag: false,
                karma: 0,
                isRunning: true,
                isSitting: false,
                isInCombat: false,
                isDead: false,
                clan: null,
                ally: null,
            };
            state.me = me;

            const config: WsConfig = {
                port: TEST_PORT + 3,
                authEnabled: false,
                authTokens: [],
                maxClients: 10,
                batchInterval: 0,
                moveThrottleMs: 100,
            };

            server = new WsApiServer(state, config);
            await new Promise(resolve => setTimeout(resolve, 100));

            const ws = new WebSocket(`ws://localhost:${TEST_PORT + 3}`);

            const messages: Array<{ type: string; data?: Record<string, unknown> }> = [];

            await new Promise<void>((resolve, reject) => {
                ws.on('message', (data) => {
                    const msg = JSON.parse(data.toString()) as { type: string; data?: Record<string, unknown> };
                    messages.push(msg);
                    if (msg.type === 'snapshot') {
                        ws.close();
                        resolve();
                    }
                });
                ws.on('error', reject);
                setTimeout(() => reject(new Error('Timeout waiting for snapshot')), WS_TIMEOUT);
            });

            const snapshot = messages.find(m => m.type === 'snapshot');
            expect(snapshot).toBeDefined();
            expect(snapshot?.data).toMatchObject({
                me: expect.objectContaining({
                    name: 'TestChar',
                    className: 'Adventurer',
                }),
                players: expect.any(Array),
                npcs: expect.any(Array),
            });
        });
    });

    describe('Запрос get.me возвращает данные me', () => {
        it('возвращает данные персонажа при запросе get.me', async () => {
            const me: CharacterMe = {
                objectId: 12345,
                name: 'MyChar',
                title: 'Hero',
                classId: 88,
                className: 'Duelist',
                level: 85,
                x: -80000,
                y: 150000,
                z: -3000,
                heading: 0,
                hp: 3000,
                maxHp: 3000,
                mp: 2000,
                maxMp: 2000,
                cp: 2500,
                maxCp: 2500,
                exp: 9999999,
                sp: 1000000,
                str: 45,
                dex: 40,
                con: 35,
                int: 25,
                wit: 20,
                men: 25,
                pAtk: 500,
                mAtk: 200,
                pDef: 400,
                mDef: 300,
                attackSpeed: 600,
                castSpeed: 400,
                runSpeed: 130,
                walkSpeed: 90,
                pvpFlag: false,
                karma: 0,
                isRunning: true,
                isSitting: false,
                isInCombat: false,
                isDead: false,
                clan: null,
                ally: null,
            };
            state.me = me;

            const config: WsConfig = {
                port: TEST_PORT + 4,
                authEnabled: false,
                authTokens: [],
                maxClients: 10,
                batchInterval: 0,
                moveThrottleMs: 100,
            };

            server = new WsApiServer(state, config);
            await new Promise(resolve => setTimeout(resolve, 100));

            const ws = new WebSocket(`ws://localhost:${TEST_PORT + 4}`);

            await new Promise<void>((resolve, reject) => {
                ws.on('open', () => {
                    // Ждем welcome и snapshot
                    let msgCount = 0;
                    ws.on('message', () => {
                        msgCount++;
                        if (msgCount >= 2) {
                            // Отправляем запрос get.me
                            ws.send(JSON.stringify({ type: 'get.me' }));
                        }
                    });
                });

                ws.on('message', (data) => {
                    const msg = JSON.parse(data.toString()) as { type: string; data?: Record<string, unknown> };
                    if (msg.type === 'me') {
                        expect(msg.data).toMatchObject({
                            name: 'MyChar',
                            title: 'Hero',
                            className: 'Duelist',
                            level: 85,
                        });
                        ws.close();
                        resolve();
                    }
                });

                ws.on('error', reject);
                setTimeout(() => reject(new Error('Timeout')), WS_TIMEOUT);
            });
        });
    });

    describe('Subscribe на ["chat"] → получаем только chat.message, не entity.move', () => {
        it('фильтрует события по подписке', async () => {
            const config: WsConfig = {
                port: TEST_PORT + 5,
                authEnabled: false,
                authTokens: [],
                maxClients: 10,
                batchInterval: 0,
                moveThrottleMs: 100,
            };

            server = new WsApiServer(state, config);
            await new Promise(resolve => setTimeout(resolve, 100));

            const ws = new WebSocket(`ws://localhost:${TEST_PORT + 5}`);

            const receivedEvents: string[] = [];
            let chatSubscribed = false;

            await new Promise<void>((resolve, reject) => {
                ws.on('open', () => {
                    let initialCount = 0;

                    ws.on('message', (data) => {
                        const msg = JSON.parse(data.toString()) as { type: string; data?: { channels?: string[] } };

                        // Игнорируем welcome и snapshot
                        if (msg.type === 'welcome' || msg.type === 'snapshot') {
                            initialCount++;
                            if (initialCount === 2) {
                                // Сначала отписываемся от всех каналов
                                ws.send(JSON.stringify({
                                    type: 'unsubscribe',
                                    channels: ['*'],
                                }));
                            }
                            return;
                        }

                        // После отписки от '*' подписываемся только на 'chat'
                        if (msg.type === 'unsubscribed') {
                            ws.send(JSON.stringify({
                                type: 'subscribe',
                                channels: ['chat'],
                            }));
                            return;
                        }

                        // После подтверждения подписки на chat генерируем события
                        if (msg.type === 'subscribed' && msg.data?.channels?.includes('chat')) {
                            chatSubscribed = true;
                            // Небольшая задержка и генерируем события
                            setTimeout(() => {
                                state.update('chat.message', { text: 'Hello' });
                                state.update('entity.move', { objectId: 1, x: 100, y: 200 });
                                state.update('chat.message', { text: 'World' });
                            }, 50);

                            // Ждем получения событий и завершаем
                            setTimeout(() => {
                                ws.close();
                                resolve();
                            }, 200);
                            return;
                        }

                        // Сохраняем все остальные события (не системные)
                        if (msg.type !== 'subscribed') {
                            receivedEvents.push(msg.type);
                        }
                    });
                });

                ws.on('error', reject);
                setTimeout(() => reject(new Error('Timeout')), WS_TIMEOUT);
            });

            // Проверяем что подписка сработала
            expect(chatSubscribed).toBe(true);

            // Должны получить только chat события
            expect(receivedEvents).toContain('chat.message');
            expect(receivedEvents).not.toContain('entity.move');
            expect(receivedEvents.filter(t => t === 'chat.message')).toHaveLength(2);
        });
    });

    describe('Ping → Pong', () => {
        it('отвечает pong на ping запрос', async () => {
            const config: WsConfig = {
                port: TEST_PORT + 6,
                authEnabled: false,
                authTokens: [],
                maxClients: 10,
                batchInterval: 0,
                moveThrottleMs: 100,
            };

            server = new WsApiServer(state, config);
            await new Promise(resolve => setTimeout(resolve, 100));

            const ws = new WebSocket(`ws://localhost:${TEST_PORT + 6}`);

            await new Promise<void>((resolve, reject) => {
                ws.on('open', () => {
                    let msgCount = 0;
                    ws.on('message', (data) => {
                        const msg = JSON.parse(data.toString()) as { type: string };

                        if (msg.type === 'welcome' || msg.type === 'snapshot') {
                            msgCount++;
                            if (msgCount >= 2) {
                                ws.send(JSON.stringify({ type: 'ping' }));
                            }
                        } else if (msg.type === 'pong') {
                            ws.close();
                            resolve();
                        }
                    });
                });

                ws.on('error', reject);
                setTimeout(() => reject(new Error('Timeout waiting for pong')), WS_TIMEOUT);
            });

            // Если дошли сюда без ошибки, pong получен
            expect(true).toBe(true);
        });

        it('pong содержит корректную структуру', async () => {
            const config: WsConfig = {
                port: TEST_PORT + 7,
                authEnabled: false,
                authTokens: [],
                maxClients: 10,
                batchInterval: 0,
                moveThrottleMs: 100,
            };

            server = new WsApiServer(state, config);
            await new Promise(resolve => setTimeout(resolve, 100));

            const ws = new WebSocket(`ws://localhost:${TEST_PORT + 7}`);

            let pongMessage: { type: string; ts: number; data: unknown } | null = null;

            await new Promise<void>((resolve, reject) => {
                ws.on('open', () => {
                    let msgCount = 0;
                    ws.on('message', (data) => {
                        const msg = JSON.parse(data.toString()) as { type: string };

                        if (msg.type === 'welcome' || msg.type === 'snapshot') {
                            msgCount++;
                            if (msgCount >= 2) {
                                ws.send(JSON.stringify({ type: 'ping' }));
                            }
                        } else if (msg.type === 'pong') {
                            pongMessage = JSON.parse(data.toString()) as { type: string; ts: number; data: unknown };
                            ws.close();
                            resolve();
                        }
                    });
                });

                ws.on('error', reject);
                setTimeout(() => reject(new Error('Timeout')), WS_TIMEOUT);
            });

            expect(pongMessage).toMatchObject({
                type: 'pong',
                ts: expect.any(Number),
                data: null,
            });
        });
    });
});
