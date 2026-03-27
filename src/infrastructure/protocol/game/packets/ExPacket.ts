/**
 * @fileoverview ExPacket - DTO для расширенных пакетов (0xfe)
 * Пакеты с суб-опкодом (extended protocol)
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface ExPacketData {
    subOpcode: number;
    subOpcodeHex: string;
    rawLength: number;
    summary: string;
    preview: string;
}

/**
 * Пакет ExPacket (0xfe)
 * Расширенный пакет с суб-опкодом (используется для дополнительных функций)
 */
export class ExPacket implements IIncomingPacket {
    readonly opcode = 0xfe;
    private data!: ExPacketData;

    decode(reader: IPacketReader): this {
        const subOpcode = reader.remaining() >= 2 ? reader.readUInt16LE() : 0;
        const buf = reader.getBuffer();
        const payload = buf.slice(3); // Skip opcode (1) + subOpcode (2)

        this.data = {
            subOpcode,
            subOpcodeHex: `0x${subOpcode.toString(16).padStart(4, '0')}`,
            rawLength: buf.length,
            summary: `Extended packet ${this.data?.subOpcodeHex || `0x${subOpcode.toString(16).padStart(4, '0')}`} (${buf.length} bytes)`,
            preview: `ExPacket: 0xfe/${subOpcode.toString(16).padStart(4, '0')}, Data: [${payload.slice(0, Math.min(8, payload.length)).join(', ')}]${payload.length > 8 ? '...' : ''}`,
        };
        return this;
    }

    getData(): ExPacketData {
        return { ...this.data };
    }
}
