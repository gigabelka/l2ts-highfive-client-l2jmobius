/**
 * @fileoverview StatusUpdatePacket - DTO для пакета StatusUpdate (0x0E)
 * Обновление статуса сущности (HP, MP, CP, уровень)
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface AttributeUpdate {
    attributeId: number;
    value: number;
}

export interface StatusUpdateData {
    objectId: number;
    attributes: AttributeUpdate[];
}

// Attribute IDs
export const StatusAttribute = {
    LEVEL: 0x01,
    EXP: 0x02,
    STR: 0x03,
    DEX: 0x04,
    CON: 0x05,
    INT: 0x06,
    WIT: 0x07,
    MEN: 0x08,
    CUR_HP: 0x09,
    MAX_HP: 0x0A,
    CUR_MP: 0x0B,
    MAX_MP: 0x0C,
    CUR_CP: 0x21,
    MAX_CP: 0x22,
} as const;

/**
 * Пакет StatusUpdate (0x0E)
 * Обновление характеристик сущности
 */
export class StatusUpdatePacket implements IIncomingPacket {
    readonly opcode = 0x0E;
    private data!: StatusUpdateData;

    decode(reader: IPacketReader): this {
        const objectId = reader.readInt32LE();
        const attributeCount = reader.readInt32LE();
        
        const attributes: AttributeUpdate[] = [];

        for (let i = 0; i < attributeCount; i++) {
            const attributeId = reader.readInt32LE();
            const value = reader.readInt32LE();
            
            attributes.push({
                attributeId,
                value,
            });
        }

        this.data = {
            objectId,
            attributes,
        };

        return this;
    }

    getData(): StatusUpdateData {
        return { ...this.data, attributes: [...this.data.attributes] };
    }

    getHp(): { current: number; max: number } | null {
        const current = this.data.attributes.find(a => a.attributeId === StatusAttribute.CUR_HP);
        const max = this.data.attributes.find(a => a.attributeId === StatusAttribute.MAX_HP);
        
        if (current && max) {
            return { current: current.value, max: max.value };
        }
        return null;
    }

    getMp(): { current: number; max: number } | null {
        const current = this.data.attributes.find(a => a.attributeId === StatusAttribute.CUR_MP);
        const max = this.data.attributes.find(a => a.attributeId === StatusAttribute.MAX_MP);
        
        if (current && max) {
            return { current: current.value, max: max.value };
        }
        return null;
    }

    getCp(): { current: number; max: number } | null {
        const current = this.data.attributes.find(a => a.attributeId === StatusAttribute.CUR_CP);
        const max = this.data.attributes.find(a => a.attributeId === StatusAttribute.MAX_CP);
        
        if (current && max) {
            return { current: current.value, max: max.value };
        }
        return null;
    }

    getLevel(): number | null {
        const attr = this.data.attributes.find(a => a.attributeId === StatusAttribute.LEVEL);
        return attr ? attr.value : null;
    }
}
