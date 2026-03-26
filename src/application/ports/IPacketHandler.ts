/**
 * @fileoverview IPacketHandler - порт для обработки пакетов
 * @module application/ports
 */

import type { Result } from '../../shared/result';

/**
 * Контекст обработки пакета
 */
export interface PacketContext {
    opcode: number;
    state: string;
    timestamp: number;
    rawBody: Buffer;
}

/**
 * Результат обработки пакета
 */
export interface PacketResult<T = unknown> {
    success: boolean;
    packet?: T;
    handlerExecuted?: boolean;
    error?: string;
    context: PacketContext;
}

/**
 * Базовый интерфейс для входящих пакетов
 */
export interface IIncomingPacket {
    decode(reader: IPacketReader, state?: string): this;
}

/**
 * Интерфейс для чтения пакетов
 */
export interface IPacketReader {
    readUInt8(): number;
    readUInt16LE(): number;
    readInt16LE(): number;
    readInt32LE(): number;
    readInt64LE(): bigint;
    readDouble(): number;
    readFloatLE(): number;
    readBytes(n: number): Buffer;
    readStringUTF16(): string;
    remaining(): number;
    skip(n: number): this;
    getBuffer(): Buffer;
}

/**
 * Интерфейс для записи пакетов
 */
export interface IPacketWriter {
    writeUInt8(value: number): this;
    writeUInt16LE(value: number): this;
    writeInt32LE(value: number): this;
    writeInt64LE(value: bigint): this;
    writeDouble(value: number): this;
    writeFloatLE(value: number): this;
    writeBytes(value: Buffer): this;
    writeStringUTF16(value: string): this;
    toBuffer(): Buffer;
}

/**
 * Стратегия обработки пакета (Strategy pattern)
 */
export interface IPacketHandlerStrategy {
    /**
     * Может ли обработать данный опкод в данном состоянии
     */
    canHandle(opcode: number, state: string): boolean;

    /**
     * Обработать пакет
     */
    handle(context: PacketContext, reader: IPacketReader): void;
}

/**
 * Фабрика для создания входящих пакетов (Factory pattern)
 */
export interface IIncomingPacketFactory {
    /**
     * Создать пакет по опкоду
     */
    create(opcode: number, reader: IPacketReader): Result<IIncomingPacket, PacketError>;

    /**
     * Регистрация пакета (для расширения без модификации - OCP)
     */
    register(opcode: number, constructor: new () => IIncomingPacket): void;

    /**
     * Проверить поддерживается ли опкод
     */
    supports(opcode: number): boolean;
}

/**
 * Фабрика для исходящих пакетов
 */
export interface IOutgoingPacketFactory {
    /**
     * Создать пакет аутентификации
     */
    createAuthRequest(session: unknown, username: string): Buffer;

    /**
     * Создать пакет входа в мир
     */
    createEnterWorld(): Buffer;

    /**
     * Создать пакет атаки
     */
    createAttackRequest(targetId: number): Buffer;

    /**
     * Создать пакет использования скила
     */
    createUseSkill(skillId: number, targetId?: number): Buffer;

    /**
     * Создать пакет движения
     */
    createMoveToLocation(x: number, y: number, z: number): Buffer;

    /**
     * Создать пакет чата
     */
    createChatMessage(message: string, channel: string): Buffer;
}

/**
 * Ошибки пакетов
 */
export class PacketError extends Error {
    constructor(
        message: string,
        public readonly opcode?: number,
        public override readonly cause?: Error
    ) {
        super(message);
        this.name = 'PacketError';
    }

    static unknownOpcode(opcode: number): PacketError {
        return new PacketError(`Unknown opcode: 0x${opcode.toString(16).padStart(2, '0')}`, opcode);
    }

    static decodeFailed(opcode: number, reason: string): PacketError {
        return new PacketError(`Failed to decode opcode 0x${opcode.toString(16)}: ${reason}`, opcode);
    }

    static encodeFailed(reason: string): PacketError {
        return new PacketError(`Failed to encode: ${reason}`);
    }
}

/**
 * Процессор пакетов (координирует фабрику и стратегии)
 */
export interface IPacketProcessor {
    /**
     * Зарегистрировать стратегию обработки
     */
    registerHandler(handler: IPacketHandlerStrategy): void;

    /**
     * Обработать пакет
     */
    process(opcode: number, data: Buffer, state: string): PacketResult;
}
