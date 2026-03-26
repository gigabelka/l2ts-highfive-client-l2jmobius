/**
 * @fileoverview LoginPacketRegistry - автоматическая регистрация пакетов и обработчиков
 * Централизованная конфигурация всех пакетов Login Server
 * @module login/protocol
 */

import type { SessionManager } from '../session/SessionManager';
import type { BaseHandler } from './handlers/BaseHandler';

// Handlers
import { InitHandler } from './handlers/InitHandler';
import { LoginFailHandler } from './handlers/LoginFailHandler';
import { ServerListHandler } from './handlers/ServerListHandler';
import { GGAuthHandler } from './handlers/GGAuthHandler';
import { LoginOkHandler } from './handlers/LoginOkHandler';
import { PlayOkHandler } from './handlers/PlayOkHandler';
import { PlayFailHandler } from './handlers/PlayFailHandler';

// Packets (для type-only imports)
import type { InitPacket } from '../packets/incoming/InitPacket';
import type { GGAuthPacket } from '../packets/incoming/GGAuthPacket';
import type { LoginOkPacket } from '../packets/incoming/LoginOkPacket';
import type { LoginFailPacket } from '../packets/incoming/LoginFailPacket';
import type { ServerListPacket } from '../packets/incoming/ServerListPacket';
import type { PlayOkPacket } from '../packets/incoming/PlayOkPacket';
import type { PlayFailPacket } from '../packets/incoming/PlayFailPacket';

/**
 * Конфигурация пакета
 */
interface PacketConfig {
    opcode: number;
    name: string;
    description?: string;
    states: string[]; // Состояния FSM в которых пакет валиден
}

/**
 * Конфигурация обработчика
 */
interface HandlerConfig {
    opcode: number;
    handlerClass: new (
        sessionManager: SessionManager
    ) => BaseHandler;
    description?: string;
}

/**
 * Реестр всех пакетов Login Server
 * Добавляйте новые пакеты здесь для автоматической регистрации
 */
const PACKET_REGISTRY: PacketConfig[] = [
    {
        opcode: 0x00,
        name: 'InitPacket',
        description: 'Login Server initialization - session ID, RSA key, Blowfish key',
        states: ['WAIT_INIT'],
    },
    {
        opcode: 0x0B,
        name: 'GGAuthPacket',
        description: 'GGAuth response',
        states: ['WAIT_GG_AUTH'],
    },
    {
        opcode: 0x03,
        name: 'LoginOkPacket',
        description: 'Login successful - returns session keys',
        states: ['WAIT_LOGIN_OK'],
    },
    {
        opcode: 0x01,
        name: 'LoginFailPacket',
        description: 'Login failed with reason code',
        states: ['WAIT_INIT', 'WAIT_LOGIN_OK'],
    },
    {
        opcode: 0x04,
        name: 'ServerListPacket',
        description: 'List of available game servers',
        states: ['WAIT_SERVER_LIST'],
    },
    {
        opcode: 0x07,
        name: 'PlayOkPacket',
        description: 'Play OK - authentication complete, can connect to Game Server',
        states: ['WAIT_PLAY_OK'],
    },
    {
        opcode: 0x06,
        name: 'PlayFailPacket',
        description: 'Play failed with reason code',
        states: ['WAIT_PLAY_OK'],
    },
];

/**
 * Реестр обработчиков
 */
const HANDLER_REGISTRY: HandlerConfig[] = [
    {
        opcode: 0x00,
        handlerClass: InitHandler,
        description: 'Handles Init packet - stores session ID and keys',
    },
    {
        opcode: 0x0B,
        handlerClass: GGAuthHandler,
        description: 'Handles GGAuth response',
    },
    {
        opcode: 0x03,
        handlerClass: LoginOkHandler,
        description: 'Handles LoginOk - stores session keys',
    },
    {
        opcode: 0x01,
        handlerClass: LoginFailHandler,
        description: 'Handles LoginFail - emits auth failure event',
    },
    {
        opcode: 0x04,
        handlerClass: ServerListHandler,
        description: 'Handles ServerList - stores server info',
    },
    {
        opcode: 0x07,
        handlerClass: PlayOkHandler,
        description: 'Handles PlayOk - completes authentication',
    },
    {
        opcode: 0x06,
        handlerClass: PlayFailHandler,
        description: 'Handles PlayFail - emits auth failure event',
    },
];

/**
 * Настроить фабрику пакетов
 * @param factory - Экземпляр фабрики (опционально)
 * @returns Настроенная фабрика
 */
export function configureLoginPacketFactory(factory?: import('./LoginIncomingPacketFactory').LoginIncomingPacketFactory): import('./LoginIncomingPacketFactory').LoginIncomingPacketFactory {
    const { LoginIncomingPacketFactory } = require('./LoginIncomingPacketFactory');
    const packetFactory = factory || new LoginIncomingPacketFactory();

    // Регистрируем все пакеты из реестра
    for (const config of PACKET_REGISTRY) {
        const packetClass = getPacketClass(config.opcode);
        if (packetClass) {
            packetFactory.register(config.opcode, packetClass as new () => import('../../application/ports').IIncomingPacket, {
                name: config.name,
                description: config.description,
                states: config.states,
            });
        }
    }

    return packetFactory;
}

/**
 * Настроить процессор пакетов
 * @param processor - Экземпляр процессора
 * @param sessionManager - Менеджер сессии
 */
export function configureLoginPacketProcessor(
    processor: import('./LoginPacketProcessor').LoginPacketProcessor,
    sessionManager: SessionManager
): void {
    for (const config of HANDLER_REGISTRY) {
        const handler = new config.handlerClass(sessionManager);
        processor.registerHandler(handler);
    }
}

/**
 * Получить класс пакета по опкоду
 */
function getPacketClass(opcode: number): (new () => unknown) | undefined {
    switch (opcode) {
        case 0x00: return require('../packets/incoming/InitPacket').InitPacket as new () => InitPacket;
        case 0x0B: return require('../packets/incoming/GGAuthPacket').GGAuthPacket as new () => GGAuthPacket;
        case 0x03: return require('../packets/incoming/LoginOkPacket').LoginOkPacket as new () => LoginOkPacket;
        case 0x01: return require('../packets/incoming/LoginFailPacket').LoginFailPacket as new () => LoginFailPacket;
        case 0x04: return require('../packets/incoming/ServerListPacket').ServerListPacket as new () => ServerListPacket;
        case 0x07: return require('../packets/incoming/PlayOkPacket').PlayOkPacket as new () => PlayOkPacket;
        case 0x06: return require('../packets/incoming/PlayFailPacket').PlayFailPacket as new () => PlayFailPacket;
        default: return undefined;
    }
}

/**
 * Получить список зарегистрированных опкодов
 */
export function getRegisteredOpcodes(): number[] {
    return PACKET_REGISTRY.map((p) => p.opcode).sort((a, b) => a - b);
}

/**
 * Проверить, поддерживается ли опкод
 */
export function isOpcodeSupported(opcode: number): boolean {
    return PACKET_REGISTRY.some((p) => p.opcode === opcode);
}

/**
 * Получить информацию о пакете по опкоду
 */
export function getPacketInfo(opcode: number): PacketConfig | undefined {
    return PACKET_REGISTRY.find((p) => p.opcode === opcode);
}

/**
 * Получить полный реестр пакетов
 */
export function getFullPacketRegistry(): ReadonlyArray<PacketConfig> {
    return Object.freeze([...PACKET_REGISTRY]);
}

/**
 * Получить полный реестр обработчиков
 */
export function getFullHandlerRegistry(): ReadonlyArray<HandlerConfig> {
    return Object.freeze([...HANDLER_REGISTRY]);
}

/**
 * Получить количество зарегистрированных пакетов
 */
export function getRegisteredPacketCount(): number {
    return PACKET_REGISTRY.length;
}

/**
 * Получить количество обработчиков
 */
export function getHandlerCount(): number {
    return HANDLER_REGISTRY.length;
}

/**
 * Проверить есть ли обработчик для опкода
 */
export function hasHandler(opcode: number): boolean {
    return HANDLER_REGISTRY.some((h) => h.opcode === opcode);
}
