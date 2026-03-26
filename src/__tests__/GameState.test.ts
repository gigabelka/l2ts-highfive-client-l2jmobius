/**
 * @fileoverview GameState Tests
 * @module __tests__/GameState
 *
 * Тесты для GameState - хранилища состояния игры
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameState } from '../game/GameState';
import { CharacterMe, Player, Npc, ChatMessage } from '../game/entities/types';

describe('GameState', () => {
    let state: GameState;

    beforeEach(() => {
        state = new GameState();
    });

    describe('Создание и базовое состояние', () => {
        it('должен создаваться пустой GameState', () => {
            expect(state.me).toBeNull();
            expect(state.players.size).toBe(0);
            expect(state.npcs.size).toBe(0);
            expect(state.items.size).toBe(0);
            expect(state.inventory.size).toBe(0);
            expect(state.skills).toHaveLength(0);
            expect(state.party).toHaveLength(0);
            expect(state.chat).toHaveLength(0);
            expect(state.effects).toHaveLength(0);
            expect(state.target).toBeNull();
            expect(state.serverTime).toBe(0);
        });

        it('getSnapshot() возвращает корректную структуру с пустыми коллекциями', () => {
            const snapshot = state.getSnapshot() as Record<string, unknown>;

            expect(snapshot.me).toBeNull();
            expect(snapshot.players).toEqual([]);
            expect(snapshot.npcs).toEqual([]);
            expect(snapshot.items).toEqual([]);
            expect(snapshot.inventory).toEqual([]);
            expect(snapshot.skills).toEqual([]);
            expect(snapshot.party).toEqual([]);
            expect(snapshot.chat).toEqual([]);
            expect(snapshot.effects).toEqual([]);
            expect(snapshot.target).toBeNull();
            expect(snapshot.serverTime).toBe(0);
        });
    });

    describe('update() и события', () => {
        it('update() эмитит событие "ws:event"', () => {
            const listener = vi.fn();
            state.on('ws:event', listener);

            state.update('test.event', { foo: 'bar' });

            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'test.event',
                    data: { foo: 'bar' },
                    ts: expect.any(Number),
                })
            );
        });

        it('update() эмитит разные события', () => {
            const listener = vi.fn();
            state.on('ws:event', listener);

            state.update('player.appear', { objectId: 1 });
            state.update('npc.appear', { objectId: 2 });
            state.update('chat.message', { text: 'hello' });

            expect(listener).toHaveBeenCalledTimes(3);
        });
    });

    describe('calcDistance()', () => {
        it('calcDistance() возвращает 0 если персонаж не инициализирован', () => {
            const distance = state.calcDistance(100, 200);
            expect(distance).toBe(0);
        });

        it('calcDistance() считает расстояние правильно', () => {
            // Gludin координаты: -80826, 149775 (примерная позиция в порту)
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

            // Точка рядом: смещение на 30 по X и 40 по Y
            // Ожидаемое расстояние: sqrt(30² + 40²) = 50
            const distance = state.calcDistance(-80796, 149815);
            expect(distance).toBeCloseTo(50, 1);
        });

        it('calcDistance() считает расстояние до нулевой точки', () => {
            const me: CharacterMe = {
                objectId: 12345,
                name: 'TestChar',
                title: '',
                classId: 0,
                className: 'Human Fighter',
                level: 1,
                x: 0,
                y: 0,
                z: 0,
                heading: 0,
                hp: 100,
                maxHp: 100,
                mp: 100,
                maxMp: 100,
                cp: 100,
                maxCp: 100,
                exp: 0,
                sp: 0,
                str: 40,
                dex: 30,
                con: 43,
                int: 21,
                wit: 11,
                men: 25,
                pAtk: 10,
                mAtk: 5,
                pDef: 50,
                mDef: 30,
                attackSpeed: 300,
                castSpeed: 200,
                runSpeed: 115,
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

            const distance = state.calcDistance(300, 400);
            expect(distance).toBeCloseTo(500, 1);
        });
    });

    describe('reset()', () => {
        it('reset() очищает все коллекции', () => {
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
            state.players.set(1, { objectId: 1, name: 'Player1' } as Player);
            state.npcs.set(2, { objectId: 2, npcId: 20006 } as Npc);
            state.skills = [{ id: 1, name: 'Skill', level: 1, isPassive: false, isToggle: false, isDisabled: false, cooldownRemaining: 0 }];
            state.party = [{ objectId: 1, name: 'Member', level: 80, classId: 92, hp: 100, maxHp: 100, mp: 100, maxMp: 100, cp: 100, maxCp: 100 }];
            state.chat = [{ timestamp: Date.now(), type: 'all', sender: 'Test', message: 'Hello' }];
            state.effects = [{ skillId: 1, skillName: 'Buff', level: 1, remainingSeconds: 300, isBuff: true }];
            state.serverTime = 1234567890;

            // Проверяем что данные есть
            expect(state.me).not.toBeNull();
            expect(state.players.size).toBe(1);
            expect(state.npcs.size).toBe(1);

            // Сбрасываем
            state.reset();

            // Проверяем что всё очищено
            expect(state.me).toBeNull();
            expect(state.players.size).toBe(0);
            expect(state.npcs.size).toBe(0);
            expect(state.items.size).toBe(0);
            expect(state.inventory.size).toBe(0);
            expect(state.skills).toHaveLength(0);
            expect(state.party).toHaveLength(0);
            expect(state.chat).toHaveLength(0);
            expect(state.effects).toHaveLength(0);
            expect(state.target).toBeNull();
            expect(state.serverTime).toBe(0);
        });
    });

    describe('Chat truncation', () => {
        it('chat обрезается до 50 при getSnapshot (добавь 60 сообщений, проверь что в снимке 50)', () => {
            // Добавляем 60 сообщений
            for (let i = 0; i < 60; i++) {
                state.chat.push({
                    timestamp: Date.now() + i,
                    type: 'all',
                    sender: `Player${i}`,
                    message: `Message ${i}`,
                });
            }

            expect(state.chat).toHaveLength(60);

            const snapshot = state.getSnapshot() as { chat: ChatMessage[] };

            expect(snapshot.chat).toHaveLength(50);
            // Последние 50 сообщений (с 10 по 59)
            expect(snapshot.chat[0].message).toBe('Message 10');
            expect(snapshot.chat[49].message).toBe('Message 59');
        });

        it('chat в снапшоте содержит последние 50 сообщений в правильном порядке', () => {
            // Добавляем 55 сообщений
            for (let i = 1; i <= 55; i++) {
                state.chat.push({
                    timestamp: Date.now() + i,
                    type: 'shout',
                    sender: 'TestSender',
                    message: `Msg${i}`,
                });
            }

            const snapshot = state.getSnapshot() as { chat: ChatMessage[] };

            // Должны быть сообщения с Msg6 по Msg55
            expect(snapshot.chat).toHaveLength(50);
            expect(snapshot.chat[0].message).toBe('Msg6');
            expect(snapshot.chat[49].message).toBe('Msg55');
        });
    });
});
