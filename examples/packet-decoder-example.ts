/**
 * @fileoverview Пример использования PacketDecoder
 * Демонстрация преобразования WebSocket сообщений в читаемые события
 */

import {
    decodePacket,
    getPacketDefinition,
    getSupportedOpcodes,
    isOpcodeKnown,
    type RawPacketMessage,
} from '../src/infrastructure/protocol/game/PacketDecoder';

// Примеры входящих WebSocket сообщений
const examples: RawPacketMessage[] = [
    // Пример 1: Движение персонажа
    {
        type: 'system.raw_packet',
        channel: 'system',
        payload: {
            opcode: 0x01,
            opcodeHex: '0x01',
            length: 47,
            state: 'IN_GAME',
            objectId: 268435456,
            toX: 83200,
            toY: 148000,
            toZ: -3400,
            fromX: 83100,
            fromY: 147900,
            fromZ: -3400,
        },
        timestamp: '2026-03-19T12:34:56.789Z',
    },

    // Пример 2: Атака с критическим ударом
    {
        type: 'system.raw_packet',
        channel: 'system',
        payload: {
            opcode: 0x0F,
            opcodeHex: '0x0F',
            length: 37,
            state: 'IN_GAME',
            attackerId: 268435456,
            targetId: 268435457,
            damage: 2450,
            critical: true,
            miss: false,
            soulshot: true,
        },
        timestamp: '2026-03-19T12:34:57.123Z',
    },

    // Пример 3: Сообщение в чате
    {
        type: 'system.raw_packet',
        channel: 'system',
        payload: {
            opcode: 0x02,
            opcodeHex: '0x02',
            length: 128,
            state: 'IN_GAME',
            objectId: 268435457,
            type: 0, // ALL
            name: 'DarkKnight',
            channelName: 'ALL',
            text: 'Продам стратилу, пм!',
        },
        timestamp: '2026-03-19T12:35:01.456Z',
    },

    // Пример 4: Смерть персонажа
    {
        type: 'system.raw_packet',
        channel: 'system',
        payload: {
            opcode: 0x05,
            opcodeHex: '0x05',
            length: 21,
            state: 'IN_GAME',
            objectId: 268435458,
            isKnownPlayer: true,
            sweepable: true,
        },
        timestamp: '2026-03-19T12:35:10.000Z',
    },

    // Пример 5: UserInfo (полная информация о персонаже)
    {
        type: 'system.raw_packet',
        channel: 'system',
        payload: {
            opcode: 0x04,
            opcodeHex: '0x04',
            length: 315,
            state: 'IN_GAME',
            name: 'MyCharacter',
            race: 0, // Human
            sex: 0,  // Male
            class: 0, // Fighter
            level: 80,
            exp: 1234567890,
            hp: 8500,
            mp: 1200,
            sp: 500000,
            karma: 0,
            x: 83200,
            y: 148000,
            z: -3400,
        },
        timestamp: '2026-03-19T12:35:15.300Z',
    },

    // Пример 6: Ping от сервера
    {
        type: 'system.raw_packet',
        channel: 'system',
        payload: {
            opcode: 0xD3,
            opcodeHex: '0xD3',
            length: 2,
            state: 'IN_GAME',
        },
        timestamp: '2026-03-19T12:35:20.000Z',
    },

    // Пример 7: Неизвестный пакет
    {
        type: 'system.raw_packet',
        channel: 'system',
        payload: {
            opcode: 0xAB,
            opcodeHex: '0xAB',
            length: 15,
            state: 'IN_GAME',
        },
        timestamp: '2026-03-19T12:35:25.500Z',
    },
];

console.log('='.repeat(80));
console.log('PacketDecoder Demo - L2 Interlude');
console.log('='.repeat(80));

// Декодируем и выводим все примеры
for (const [index, message] of examples.entries()) {
    const decoded = decodePacket(message);

    console.log(`\n--- Пример ${index + 1}: ${decoded.packet.name} ---`);
    console.log('Входное сообщение:');
    console.log(JSON.stringify(message, null, 2));

    console.log('\nДекодированное событие:');
    console.log(JSON.stringify(decoded, null, 2));
}

// Демонстрация вспомогательных функций
console.log('\n' + '='.repeat(80));
console.log('Вспомогательные функции');
console.log('='.repeat(80));

console.log('\nИзвестные опкоды:', getSupportedOpcodes().slice(0, 10), '... (всего', getSupportedOpcodes().length, ')');

console.log('\nПроверка опкодов:');
console.log('  0x04 (UserInfo) известен?', isOpcodeKnown(0x04));
console.log('  0xFF (Unknown) известен?', isOpcodeKnown(0xFF));

console.log('\nОпределение пакета 0x04:');
const def = getPacketDefinition(0x04);
console.log('  Название:', def?.name);
console.log('  Категория:', def?.category);
console.log('  Поля:', def?.fields.join(', '));

// Пример обработки потока пакетов
console.log('\n' + '='.repeat(80));
console.log('Обработка потока пакетов (Summary)');
console.log('='.repeat(80));

console.log('\nЛог событий:');
for (const message of examples) {
    const decoded = decodePacket(message);
    const time = decoded.timestamp.split('T')[1]?.replace('Z', '') ?? '?';
    console.log(`[${time}] [${decoded.packet.category.padEnd(10)}] ${decoded.summary}`);
}

console.log('\n' + '='.repeat(80));
console.log('Demo завершён!');
console.log('='.repeat(80));
