/**
 * @fileoverview GameIncomingPacketFactory - Factory для входящих пакетов Game Server
 * Паттерн: Factory Method + Registry для OCP (Open-Closed Principle)
 * @module infrastructure/protocol/game
 */

import { Result } from '../../../shared/result';
import type {
    IIncomingPacket,
    IIncomingPacketFactory,
    IPacketReader,
    PacketError,
} from '../../../application/ports';
import { PacketReader } from '../../../network/PacketReader';

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
 * Factory для входящих пакетов Game Server
 * Регистрация новых пакетов без модификации кода (OCP)
 */
export class GameIncomingPacketFactory implements IIncomingPacketFactory {
    private registry = new Map<number, { ctor: PacketConstructor; meta: PacketMetadata }>();

    /**
     * Регистрация пакета
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
     * Массовая регистрация
     */
    registerMany(packets: Array<{ opcode: number; ctor: PacketConstructor; meta?: Partial<PacketMetadata> }>): this {
        packets.forEach((p) => this.register(p.opcode, p.ctor, p.meta));
        return this;
    }

    /**
     * Создать пакет из опкода и данных
     */
    create(opcode: number, _reader: IPacketReader): Result<IIncomingPacket, PacketError> {
        const entry = this.registry.get(opcode);
        if (!entry) {
            return Result.err({
                message: `Unknown opcode: 0x${opcode.toString(16).padStart(2, '0')}`,
                opcode,
            } as PacketError);
        }

        // Simply create packet instance without decoding
        // Decoding will be done by the handler
        const packet = new entry.ctor();
        return Result.ok(packet);
    }

    /**
     * Создать пакет из Buffer
     */
    createFromBuffer(opcode: number, data: Buffer): Result<IIncomingPacket, PacketError> {
        const reader = new PacketReader(data);
        return this.create(opcode, reader);
    }

    /**
     * Проверить поддержку опкода
     */
    supports(opcode: number): boolean {
        return this.registry.has(opcode);
    }

    /**
     * Получить метаданные
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
     * Удалить регистрацию
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
}

/**
 * Singleton instance
 */
export const gameIncomingPacketFactory = new GameIncomingPacketFactory();
