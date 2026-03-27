/**
 * @fileoverview GenericServerPacket - универсальный пакет для распознанных, но не полностью парсимых опкодов
 * Сохраняет сырые данные и предоставляет базовую информацию
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface GenericServerPacketData {
    rawLength: number;
    summary: string;
    preview: string;
    opcodeHex: string;
    /** Первые int32 часто является objectId */
    objectId?: number;
}

/**
 * Универсальный серверный пакет
 * Используется для опкодов, которые распознаны (имеют имя),
 * но для которых нет полной реализации парсинга.
 * 
 * Гарантирует что пакет НЕ будет показан как "UnknownPacket" в дашборде.
 */
export class GenericServerPacket implements IIncomingPacket {
    readonly opcode: number;
    private data!: GenericServerPacketData;

    constructor(opcode?: number) {
        this.opcode = opcode ?? 0x00;
    }

    decode(reader: IPacketReader): this {
        const buf = reader.getBuffer();
        // Пропускаем первый байт (opcode) если буфер включает его
        const payloadStart = 1;
        const payload = buf.subarray(payloadStart);

        let objectId: number | undefined;
        if (payload.length >= 4) {
            objectId = payload.readInt32LE(0);
        }

        this.data = {
            rawLength: buf.length,
            summary: `Generic packet (${buf.length} bytes)`,
            preview: `Opcode: 0x${this.opcode.toString(16).padStart(2, '0')}, Data: [${payload.slice(0, Math.min(8, payload.length)).join(', ')}]${payload.length > 8 ? '...' : ''}`,
            opcodeHex: `0x${this.opcode.toString(16).padStart(2, '0')}`,
            objectId,
        };

        return this;
    }

    getData(): GenericServerPacketData {
        return { ...this.data };
    }
}

/**
 * Фабрика для создания GenericServerPacket с конкретным опкодом
 */
export function createGenericPacketClass(opcode: number): new () => IIncomingPacket {
    return class extends GenericServerPacket {
        constructor() {
            super(opcode);
        }
    };
}
