/**
 * @fileoverview LoginIncomingPacketFactory - Factory для входящих пакетов Login Server
 * Паттерн: Factory Method + Registry для OCP (Open-Closed Principle)
 * @module login/protocol
 */

import { Result } from '../../shared/result';
import type {
    IIncomingPacket,
    IPacketReader,
    PacketError,
} from '../../application/ports';

/**
 * Метаданные пакета
 */
export interface PacketMetadata {
    opcode: number;
    name: string;
    description?: string;
    minLength?: number;
    states?: string[];
}

/**
 * Конструктор пакета
 */
export type PacketConstructor = new () => IIncomingPacket;

/**
 * Factory для входящих пакетов Login Server
 * Регистрация новых пакетов без модификации кода (OCP)
 * 
 * Пример добавления нового пакета:
 * ```typescript
 * factory.register(0x00, InitPacket, { 
 *     name: 'InitPacket',
 *     description: 'Login Server initialization' 
 * });
 * ```
 */
export class LoginIncomingPacketFactory {
    private registry = new Map<number, { ctor: PacketConstructor; meta: PacketMetadata }>();

    /**
     * Регистрация пакета
     * @param opcode - Опкод пакета
     * @param constructor - Конструктор класса пакета
     * @param metadata - Метаданные пакета
     */
    register(opcode: number, constructor: PacketConstructor, metadata?: Partial<PacketMetadata>): this {
        const meta: PacketMetadata = {
            opcode,
            name: constructor.name,
            ...metadata,
        };

        this.registry.set(opcode, { ctor: constructor, meta });
        return this;
    }

    /**
     * Массовая регистрация пакетов
     * @param packets - Массив конфигураций пакетов
     */
    registerMany(packets: Array<{ opcode: number; ctor: PacketConstructor; meta?: Partial<PacketMetadata> }>): this {
        packets.forEach((p) => this.register(p.opcode, p.ctor, p.meta));
        return this;
    }

    /**
     * Создать пакет по опкоду
     * @param opcode - Опкод пакета
     * @returns Result с созданным пакетом или ошибкой
     */
    create(opcode: number): Result<IIncomingPacket, PacketError> {
        const entry = this.registry.get(opcode);
        if (!entry) {
            return Result.err({
                message: `Unknown opcode: 0x${opcode.toString(16).padStart(2, '0')}`,
                opcode,
            } as PacketError);
        }

        // Создаём экземпляр пакета без декодирования
        // Декодирование выполняется обработчиком
        const packet = new entry.ctor();
        return Result.ok(packet);
    }

    /**
     * Создать и декодировать пакет из Reader
     * @param opcode - Опкод пакета
     * @param reader - Reader для декодирования
     * @returns Result с декодированным пакетом или ошибкой
     */
    createAndDecode(opcode: number, reader: IPacketReader): Result<IIncomingPacket, PacketError> {
        const createResult = this.create(opcode);
        if (createResult.isErr()) {
            return createResult;
        }

        try {
            const packet = createResult.getOrThrow();
            packet.decode(reader);
            return Result.ok(packet);
        } catch (error) {
            return Result.err({
                message: `Failed to decode opcode 0x${opcode.toString(16)}: ${error}`,
                opcode,
            } as PacketError);
        }
    }

    /**
     * Проверить поддержку опкода
     * @param opcode - Опкод для проверки
     */
    supports(opcode: number): boolean {
        return this.registry.has(opcode);
    }

    /**
     * Получить метаданные пакета
     * @param opcode - Опкод пакета
     */
    getMetadata(opcode: number): PacketMetadata | undefined {
        return this.registry.get(opcode)?.meta;
    }

    /**
     * Получить все зарегистрированные опкоды
     */
    getRegisteredOpcodes(): number[] {
        return Array.from(this.registry.keys()).sort((a, b) => a - b);
    }

    /**
     * Получить все метаданные
     */
    getAllMetadata(): PacketMetadata[] {
        return Array.from(this.registry.values())
            .map((e) => e.meta)
            .sort((a, b) => a.opcode - b.opcode);
    }

    /**
     * Удалить регистрацию пакета
     * @param opcode - Опкод для удаления
     */
    unregister(opcode: number): boolean {
        return this.registry.delete(opcode);
    }

    /**
     * Очистить все регистрации
     */
    clear(): void {
        this.registry.clear();
    }

    /**
     * Получить количество зарегистрированных пакетов
     */
    getCount(): number {
        return this.registry.size;
    }
}

/**
 * Singleton instance для глобального использования
 */
export const loginIncomingPacketFactory = new LoginIncomingPacketFactory();
