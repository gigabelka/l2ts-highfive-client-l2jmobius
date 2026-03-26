/**
 * @fileoverview Тесты для PacketDecoder
 */

import { describe, it, expect } from 'vitest';
import {
    decodePacket,
    getPacketDefinition,
    getSupportedOpcodes,
    isOpcodeKnown,
    type RawPacketMessage,
} from '../../../../src/infrastructure/protocol/game/PacketDecoder';

describe('PacketDecoder', () => {
    describe('decodePacket', () => {
        it('should decode Init packet (0x00)', () => {
            const message: RawPacketMessage = {
                type: 'system.raw_packet',
                channel: 'system',
                payload: {
                    opcode: 0x00,
                    opcodeHex: '0x00',
                    length: 192,
                    state: 'IN_GAME',
                },
                timestamp: '2026-03-19T12:00:00.000Z',
            };

            const result = decodePacket(message);

            expect(result.type).toBe('auth.init');
            expect(result.packet.name).toBe('Init');
            expect(result.packet.category).toBe('AUTH');
            expect(result.packet.data.blowfishKey).toBeNull();
            expect(result.packet.data.sessionId).toBeNull();
            expect(result.summary).toContain('Инициализация');
        });

        it('should decode MoveToLocation packet (0x01)', () => {
            const message: RawPacketMessage = {
                type: 'system.raw_packet',
                channel: 'system',
                payload: {
                    opcode: 0x01,
                    opcodeHex: '0x01',
                    length: 47,
                    state: 'IN_GAME',
                    objectId: 12345,
                    toX: 100,
                    toY: 200,
                    toZ: 50,
                    fromX: 90,
                    fromY: 190,
                    fromZ: 50,
                },
                timestamp: '2026-03-19T12:00:00.000Z',
            };

            const result = decodePacket(message);

            expect(result.type).toBe('game.move.movetolocation');
            expect(result.packet.name).toBe('MoveToLocation');
            expect(result.packet.category).toBe('MOVEMENT');
            expect(result.packet.data.objectId).toBe(12345);
            expect(result.packet.data.toX).toBe(100);
            expect(result.summary).toContain('движение');
            expect(result.summary).toContain('(100, 200, 50)');
        });

        it('should decode Attack packet (0x0F)', () => {
            const message: RawPacketMessage = {
                type: 'system.raw_packet',
                channel: 'system',
                payload: {
                    opcode: 0x0F,
                    opcodeHex: '0x0F',
                    length: 37,
                    state: 'IN_GAME',
                    attackerId: 12345,
                    damage: 150,
                    critical: true,
                },
                timestamp: '2026-03-19T12:00:00.000Z',
            };

            const result = decodePacket(message);

            expect(result.type).toBe('game.combat.attack');
            expect(result.packet.name).toBe('Attack');
            expect(result.packet.category).toBe('COMBAT');
            expect(result.summary).toContain('урон 150');
            expect(result.summary).toContain('Крит');
        });

        it('should decode Say2 packet (0x02)', () => {
            const message: RawPacketMessage = {
                type: 'system.raw_packet',
                channel: 'system',
                payload: {
                    opcode: 0x02,
                    opcodeHex: '0x02',
                    length: 128,
                    state: 'IN_GAME',
                    objectId: 12345,
                    type: 0,
                    name: 'PlayerName',
                    channelName: 'Shout',
                    text: 'Hello world!',
                },
                timestamp: '2026-03-19T12:00:00.000Z',
            };

            const result = decodePacket(message);

            expect(result.type).toBe('game.chat.say2');
            expect(result.packet.name).toBe('Say2');
            expect(result.packet.category).toBe('CHAT');
            expect(result.summary).toContain('[Shout]');
            expect(result.summary).toContain('PlayerName');
            expect(result.summary).toContain('Hello world!');
        });

        it('should decode Die packet (0x05)', () => {
            const message: RawPacketMessage = {
                type: 'system.raw_packet',
                channel: 'system',
                payload: {
                    opcode: 0x05,
                    opcodeHex: '0x05',
                    length: 21,
                    state: 'IN_GAME',
                    objectId: 12345,
                    isKnownPlayer: true,
                    sweepable: true,
                },
                timestamp: '2026-03-19T12:00:00.000Z',
            };

            const result = decodePacket(message);

            expect(result.type).toBe('game.combat.die');
            expect(result.packet.name).toBe('Die');
            expect(result.packet.category).toBe('COMBAT');
            expect(result.summary).toContain('погиб');
            expect(result.summary).toContain('sweep');
        });

        it('should decode UserInfo packet (0x04)', () => {
            const message: RawPacketMessage = {
                type: 'system.raw_packet',
                channel: 'system',
                payload: {
                    opcode: 0x04,
                    opcodeHex: '0x04',
                    length: 315,
                    state: 'IN_GAME',
                    name: 'TestChar',
                    level: 80,
                    hp: 5000,
                    mp: 1000,
                },
                timestamp: '2026-03-19T12:00:00.000Z',
            };

            const result = decodePacket(message);

            expect(result.type).toBe('game.status.userinfo');
            expect(result.packet.name).toBe('UserInfo');
            expect(result.packet.category).toBe('STATUS');
            expect(result.summary).toContain('уровень 80');
            expect(result.summary).toContain('HP 5000');
        });

        it('should decode TeleportToLocation packet (0x38)', () => {
            const message: RawPacketMessage = {
                type: 'system.raw_packet',
                channel: 'system',
                payload: {
                    opcode: 0x38,
                    opcodeHex: '0x38',
                    length: 52,
                    state: 'IN_GAME',
                    objectId: 12345,
                    toX: 1000,
                    toY: 2000,
                    toZ: -100,
                },
                timestamp: '2026-03-19T12:00:00.000Z',
            };

            const result = decodePacket(message);

            expect(result.type).toBe('game.move.teleporttolocation');
            expect(result.packet.name).toBe('TeleportToLocation');
            expect(result.summary).toContain('Телепорт');
            expect(result.summary).toContain('(1000, 2000, -100)');
        });

        it('should decode NetPingRequest packet (0xD3)', () => {
            const message: RawPacketMessage = {
                type: 'system.raw_packet',
                channel: 'system',
                payload: {
                    opcode: 0xD3,
                    opcodeHex: '0xD3',
                    length: 2,
                    state: 'IN_GAME',
                },
                timestamp: '2026-03-19T12:00:00.000Z',
            };

            const result = decodePacket(message);

            expect(result.type).toBe('system.netpingrequest');
            expect(result.packet.name).toBe('NetPingRequest');
            expect(result.packet.category).toBe('SYSTEM');
            expect(result.summary).toBe('Ping от сервера — нужен Pong');
        });

        it('should decode ActionFailed packet (0x25)', () => {
            const message: RawPacketMessage = {
                type: 'system.raw_packet',
                channel: 'system',
                payload: {
                    opcode: 0x25,
                    opcodeHex: '0x25',
                    length: 2,
                    state: 'IN_GAME',
                },
                timestamp: '2026-03-19T12:00:00.000Z',
            };

            const result = decodePacket(message);

            expect(result.type).toBe('system.actionfailed');
            expect(result.packet.name).toBe('ActionFailed');
            expect(result.summary).toBe('Действие отклонено сервером');
        });

        it('should handle unknown opcode', () => {
            const message: RawPacketMessage = {
                type: 'system.raw_packet',
                channel: 'system',
                payload: {
                    opcode: 0xFF,
                    opcodeHex: '0xFF',
                    length: 10,
                    state: 'IN_GAME',
                },
                timestamp: '2026-03-19T12:00:00.000Z',
            };

            const result = decodePacket(message);

            expect(result.type).toBe('system.unknown');
            expect(result.packet.name).toBe('Unknown');
            expect(result.packet.category).toBe('SYSTEM');
            expect(result.summary).toContain('Неизвестный пакет');
            expect(result.summary).toContain('0xFF');
        });

        it('should preserve timestamp', () => {
            const timestamp = '2026-03-19T15:30:45.123Z';
            const message: RawPacketMessage = {
                type: 'system.raw_packet',
                channel: 'system',
                payload: {
                    opcode: 0x00,
                    opcodeHex: '0x00',
                    length: 192,
                    state: 'IN_GAME',
                },
                timestamp,
            };

            const result = decodePacket(message);

            expect(result.timestamp).toBe(timestamp);
        });

        it('should set world fields to null', () => {
            const message: RawPacketMessage = {
                type: 'system.raw_packet',
                channel: 'system',
                payload: {
                    opcode: 0x04,
                    opcodeHex: '0x04',
                    length: 315,
                    state: 'IN_GAME',
                },
                timestamp: '2026-03-19T12:00:00.000Z',
            };

            const result = decodePacket(message);

            expect(result.world.zone).toBeNull();
            expect(result.world.region).toBeNull();
            expect(result.world.nearbyObjects).toBeNull();
        });
    });

    describe('getPacketDefinition', () => {
        it('should return definition for known opcodes', () => {
            const def = getPacketDefinition(0x04);
            expect(def).toBeDefined();
            expect(def?.name).toBe('UserInfo');
            expect(def?.category).toBe('STATUS');
        });

        it('should return undefined for unknown opcodes', () => {
            const def = getPacketDefinition(0xAB);
            expect(def).toBeUndefined();
        });
    });

    describe('getSupportedOpcodes', () => {
        it('should return sorted array of opcodes', () => {
            const opcodes = getSupportedOpcodes();
            expect(Array.isArray(opcodes)).toBe(true);
            expect(opcodes.length).toBeGreaterThan(30);
            expect(opcodes).toContain(0x00);
            expect(opcodes).toContain(0x04);
            expect(opcodes).toContain(0xFE);
            // Check sorted
            for (let i = 1; i < opcodes.length; i++) {
                expect(opcodes[i]).toBeGreaterThanOrEqual(opcodes[i - 1]);
            }
        });
    });

    describe('isOpcodeKnown', () => {
        it('should return true for known opcodes', () => {
            expect(isOpcodeKnown(0x00)).toBe(true);
            expect(isOpcodeKnown(0x04)).toBe(true);
            expect(isOpcodeKnown(0xFE)).toBe(true);
        });

        it('should return false for unknown opcodes', () => {
            expect(isOpcodeKnown(0xAB)).toBe(false);
            expect(isOpcodeKnown(999)).toBe(false);
        });
    });

    describe('packet categories mapping', () => {
        const testCases: Array<{ opcode: number; expectedCategory: string; expectedType: string }> = [
            { opcode: 0x00, expectedCategory: 'AUTH', expectedType: 'auth.init' },
            { opcode: 0x01, expectedCategory: 'MOVEMENT', expectedType: 'game.move.movetolocation' },
            { opcode: 0x02, expectedCategory: 'CHAT', expectedType: 'game.chat.say2' },
            { opcode: 0x03, expectedCategory: 'COMBAT', expectedType: 'game.combat.socialaction' },
            { opcode: 0x04, expectedCategory: 'STATUS', expectedType: 'game.status.userinfo' },
            { opcode: 0x0B, expectedCategory: 'SPAWN', expectedType: 'game.spawn.charinfo' },
            { opcode: 0x0A, expectedCategory: 'INVENTORY', expectedType: 'game.inventory.itemlist' },
            { opcode: 0x20, expectedCategory: 'SYSTEM', expectedType: 'system.systemmessage' },
        ];

        for (const { opcode, expectedCategory, expectedType } of testCases) {
            it(`should map opcode 0x${opcode.toString(16).padStart(2, '0')} to ${expectedCategory}`, () => {
                const message: RawPacketMessage = {
                    type: 'system.raw_packet',
                    channel: 'system',
                    payload: {
                        opcode,
                        opcodeHex: `0x${opcode.toString(16).padStart(2, '0')}`,
                        length: 10,
                        state: 'IN_GAME',
                    },
                    timestamp: '2026-03-19T12:00:00.000Z',
                };

                const result = decodePacket(message);

                expect(result.packet.category).toBe(expectedCategory);
                expect(result.type).toBe(expectedType);
            });
        }
    });
});
