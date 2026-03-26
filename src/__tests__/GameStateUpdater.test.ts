/**
 * @fileoverview GameStateUpdater Tests
 * @module __tests__/GameStateUpdater
 *
 * Тесты для GameStateUpdater - обработчика пакетов и обновления состояния
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameState } from '../game/GameState';
import { GameStateUpdater } from '../game/GameStateUpdater';
import { CharacterMe, Player, Npc, ChatMessage } from '../game/entities/types';

describe('GameStateUpdater', () => {
    let state: GameState;
    let updater: GameStateUpdater;

    beforeEach(() => {
        state = new GameState();
        updater = new GameStateUpdater(state);
    });

    // Mock данные для UserInfo (0x04) - Gludin coordinates
    const mockUserInfo = {
        objectId: 12345678,
        name: 'TestAdventurer',
        title: '',
        race: 0, // Human
        sex: 0, // Male
        classId: 93, // Adventurer (3rd profession)
        level: 80,
        exp: 1234567890,
        str: 40,
        dex: 35,
        con: 30,
        int: 21,
        wit: 20,
        men: 25,
        maxHp: 2500,
        currentHp: 2400,
        maxMp: 1500,
        currentMp: 1400,
        maxCp: 2000,
        currentCp: 1900,
        sp: 500000,
        currentLoad: 1000,
        maxLoad: 5000,
        x: -80826, // Gludin coordinates
        y: 149775,
        z: -3040,
        vehicleId: 0,
    };

    // Mock данные для CharInfo (0x03)
    const mockCharInfo = {
        objectId: 87654321,
        name: 'OtherPlayer',
        race: 0,
        sex: 1, // Female
        classId: 94, // Archmage (3rd profession)
        level: 78,
        x: -80700,
        y: 149800,
        z: -3040,
        heading: 0,
        isRunning: true,
        isInCombat: false,
        isDead: false,
        title: 'Clan Leader',
    };

    // Mock данные для NpcInfo (0x16)
    const mockNpcInfo = {
        objectId: 111222333,
        npcId: 30006, // Gatekeeper Roxxy (Gludin)
        attackable: false,
        x: -80750,
        y: 149850,
        z: -3040,
        heading: 0,
        name: '',
        title: '',
        level: 70,
        isDead: false,
        currentHp: 10000,
        maxHp: 10000,
    };

    // Mock данные для MoveToLocation (0x2E)
    const mockMove = {
        objectId: 87654321,
        targetX: -80600,
        targetY: 149900,
        targetZ: -3040,
        originX: -80700,
        originY: 149800,
        originZ: -3040,
        moveSpeed: 120,
    };

    // Mock данные для CreatureSay (0x4A)
    const mockChat = {
        objectId: 87654321,
        messageType: 0, // ALL
        senderName: 'OtherPlayer',
        message: 'Hello from Gludin!',
    };

    describe('handlePacket(0x04, mockUserInfo)', () => {
        it('обновляет state.me при получении UserInfo', () => {
            updater.handlePacket(0x04, mockUserInfo);

            expect(state.me).not.toBeNull();
            expect(state.me?.objectId).toBe(12345678);
            expect(state.me?.name).toBe('TestAdventurer');
            expect(state.me?.classId).toBe(93);
            expect(state.me?.className).toBe('Adventurer');
            expect(state.me?.level).toBe(80);
            expect(state.me?.x).toBe(-80826);
            expect(state.me?.y).toBe(149775);
            expect(state.me?.hp).toBe(2400);
            expect(state.me?.maxHp).toBe(2500);
        });

        it('эмитит событие me.update при UserInfo', () => {
            const listener = vi.fn();
            state.on('ws:event', listener);

            updater.handlePacket(0x04, mockUserInfo);

            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'me.update',
                    data: expect.objectContaining({
                        objectId: 12345678,
                        name: 'TestAdventurer',
                        className: 'Adventurer',
                    }),
                })
            );
        });
    });

    describe('handlePacket(0x03, mockCharInfo)', () => {
        it('добавляет игрока в state.players при CharInfo', () => {
            // Сначала инициализируем me для расчёта расстояния
            state.me = { x: -80826, y: 149775 } as CharacterMe;

            updater.handlePacket(0x03, mockCharInfo);

            expect(state.players.size).toBe(1);
            expect(state.players.has(87654321)).toBe(true);

            const player = state.players.get(87654321)!;
            expect(player.name).toBe('OtherPlayer');
            expect(player.classId).toBe(94);
            expect(player.className).toBe('Archmage');
            expect(player.title).toBe('Clan Leader');
        });

        it('эмитит событие player.appear для нового игрока', () => {
            state.me = { x: -80826, y: 149775 } as CharacterMe;
            const listener = vi.fn();
            state.on('ws:event', listener);

            updater.handlePacket(0x03, mockCharInfo);

            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'player.appear',
                    data: expect.objectContaining({
                        objectId: 87654321,
                        name: 'OtherPlayer',
                    }),
                })
            );
        });
    });

    describe('handlePacket(0x16, mockNpcInfo)', () => {
        it('добавляет NPC в state.npcs при NpcInfo', () => {
            state.me = { x: -80826, y: 149775 } as CharacterMe;

            updater.handlePacket(0x16, mockNpcInfo);

            expect(state.npcs.size).toBe(1);
            expect(state.npcs.has(111222333)).toBe(true);

            const npc = state.npcs.get(111222333)!;
            expect(npc.npcId).toBe(30006);
            expect(npc.name).toBe('Gatekeeper Roxxy');
            expect(npc.isAttackable).toBe(false);
        });

        it('эмитит событие npc.appear для нового NPC', () => {
            state.me = { x: -80826, y: 149775 } as CharacterMe;
            const listener = vi.fn();
            state.on('ws:event', listener);

            updater.handlePacket(0x16, mockNpcInfo);

            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'npc.appear',
                    data: expect.objectContaining({
                        npcId: 30006,
                        name: 'Gatekeeper Roxxy',
                    }),
                })
            );
        });
    });

    describe('handlePacket(0x08, { objectId: X })', () => {
        it('удаляет игрока из state.players', () => {
            // Добавляем игрока
            state.players.set(87654321, { objectId: 87654321, name: 'OtherPlayer' } as Player);
            expect(state.players.size).toBe(1);

            // Удаляем
            updater.handlePacket(0x08, { objectId: 87654321 });

            expect(state.players.size).toBe(0);
            expect(state.players.has(87654321)).toBe(false);
        });

        it('удаляет NPC из state.npcs', () => {
            state.npcs.set(111222333, { objectId: 111222333, npcId: 30006 } as Npc);
            expect(state.npcs.size).toBe(1);

            updater.handlePacket(0x08, { objectId: 111222333 });

            expect(state.npcs.size).toBe(0);
        });

        it('эмитит событие entity.despawn при удалении', () => {
            state.players.set(87654321, { objectId: 87654321, name: 'OtherPlayer' } as Player);
            const listener = vi.fn();
            state.on('ws:event', listener);

            updater.handlePacket(0x08, { objectId: 87654321 });

            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'entity.despawn',
                    data: expect.objectContaining({
                        objectId: 87654321,
                    }),
                })
            );
        });
    });

    describe('handlePacket(0x2E, mockMove)', () => {
        it('обновляет координаты игрока при MoveToLocation', () => {
            // Инициализируем me и игрока
            state.me = { x: -80826, y: 149775, objectId: 12345678 } as CharacterMe;
            state.players.set(87654321, {
                objectId: 87654321,
                name: 'OtherPlayer',
                x: -80700,
                y: 149800,
                z: -3040,
            } as Player);

            updater.handlePacket(0x2E, mockMove);

            const player = state.players.get(87654321)!;
            expect(player.x).toBe(-80600);
            expect(player.y).toBe(149900);
            expect(player.z).toBe(-3040);
        });

        it('эмитит событие entity.move при движении', () => {
            state.me = { x: -80826, y: 149775, objectId: 12345678 } as CharacterMe;
            state.players.set(87654321, {
                objectId: 87654321,
                name: 'OtherPlayer',
                x: -80700,
                y: 149800,
                z: -3040,
            } as Player);

            const listener = vi.fn();
            state.on('ws:event', listener);

            updater.handlePacket(0x2E, mockMove);

            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'entity.move',
                    data: expect.objectContaining({
                        objectId: 87654321,
                        from: { x: -80700, y: 149800, z: -3040 },
                        to: { x: -80600, y: 149900, z: -3040 },
                    }),
                })
            );
        });
    });

    describe('handlePacket(0x4A, mockChat)', () => {
        it('добавляет сообщение в state.chat при CreatureSay', () => {
            updater.handlePacket(0x4A, mockChat);

            expect(state.chat).toHaveLength(1);
            expect(state.chat[0].sender).toBe('OtherPlayer');
            expect(state.chat[0].message).toBe('Hello from Gludin!');
            expect(state.chat[0].type).toBe('all');
        });

        it('эмитит событие chat.message', () => {
            const listener = vi.fn();
            state.on('ws:event', listener);

            updater.handlePacket(0x4A, mockChat);

            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'chat.message',
                    data: expect.objectContaining({
                        sender: 'OtherPlayer',
                        message: 'Hello from Gludin!',
                    }),
                })
            );
        });

        it('ограничивает историю чата 200 сообщениями', () => {
            // Добавляем 205 сообщений
            for (let i = 0; i < 205; i++) {
                updater.handlePacket(0x4A, {
                    objectId: i,
                    messageType: 0,
                    senderName: `Player${i}`,
                    message: `Message ${i}`,
                });
            }

            expect(state.chat.length).toBeLessThanOrEqual(200);
        });
    });

    describe('Повторный CharInfo с тем же objectId', () => {
        it('обновляет существующего игрока, а не создает нового (player.update)', () => {
            state.me = { x: -80826, y: 149775 } as CharacterMe;

            // Первое появление
            updater.handlePacket(0x03, mockCharInfo);
            expect(state.players.size).toBe(1);

            const listener = vi.fn();
            state.on('ws:event', listener);

            // Обновление того же игрока
            const updatedCharInfo = { ...mockCharInfo, title: 'New Title' };
            updater.handlePacket(0x03, updatedCharInfo);

            // Размер не изменился
            expect(state.players.size).toBe(1);

            // Данные обновились
            const player = state.players.get(87654321)!;
            expect(player.title).toBe('New Title');

            // Эмитится player.update, а не player.appear
            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'player.update',
                })
            );
            expect(listener).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'player.appear',
                })
            );
        });
    });

    describe('Словари classId → className', () => {
        it('корректно маппит classId 0 в Human Fighter', () => {
            state.me = { x: 0, y: 0 } as CharacterMe;
            const fighterInfo = { ...mockCharInfo, classId: 0 };

            updater.handlePacket(0x03, fighterInfo);

            const player = state.players.get(87654321)!;
            expect(player.className).toBe('Human Fighter');
        });

        it('корректно маппит classId 88 в Duelist', () => {
            state.me = { x: 0, y: 0 } as CharacterMe;
            const duelistInfo = { ...mockCharInfo, classId: 88 };

            updater.handlePacket(0x03, duelistInfo);

            const player = state.players.get(87654321)!;
            expect(player.className).toBe('Duelist');
        });

        it('корректно маппит classId 118 в Maestro', () => {
            state.me = { x: 0, y: 0 } as CharacterMe;
            const maestroInfo = { ...mockCharInfo, classId: 118 };

            updater.handlePacket(0x03, maestroInfo);

            const player = state.players.get(87654321)!;
            expect(player.className).toBe('Maestro');
        });

        it('возвращает Unknown Class для неизвестного classId', () => {
            state.me = { x: 0, y: 0 } as CharacterMe;
            const unknownInfo = { ...mockCharInfo, classId: 9999 };

            updater.handlePacket(0x03, unknownInfo);

            const player = state.players.get(87654321)!;
            expect(player.className).toBe('Unknown Class #9999');
        });

        it('корректно маппит npcId в имя NPC', () => {
            state.me = { x: -80826, y: 149775 } as CharacterMe;

            updater.handlePacket(0x16, mockNpcInfo);

            const npc = state.npcs.get(111222333)!;
            expect(npc.name).toBe('Gatekeeper Roxxy');
        });

        it('возвращает Unknown NPC для неизвестного npcId', () => {
            state.me = { x: -80826, y: 149775 } as CharacterMe;
            const unknownNpc = { ...mockNpcInfo, npcId: 99999 };

            updater.handlePacket(0x16, unknownNpc);

            const npc = state.npcs.get(111222333)!;
            expect(npc.name).toBe('Unknown NPC #99999');
        });
    });
});
