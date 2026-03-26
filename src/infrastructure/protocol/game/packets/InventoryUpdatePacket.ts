/**
 * @fileoverview InventoryUpdatePacket - DTO для пакета InventoryUpdate (0x19)
 * Частичное обновление инвентаря (добавление/удаление/изменение предметов)
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export type InventoryChangeType = 'ADD' | 'UPDATE' | 'REMOVE';

export interface InventoryChange {
    changeType: InventoryChangeType;
    objectId: number;
    itemId: number;
    count: number;
    slot: number;
    enchantLevel: number;
    isEquipped: boolean;
    itemType1: number;
    itemType2: number;
    customType1: number;
    customType2: number;
    augmentationId: number;
    mana: number;
}

export interface InventoryUpdateData {
    changes: InventoryChange[];
}

/**
 * Пакет InventoryUpdate (0x19)
 * Обновление отдельных слотов инвентаря
 */
export class InventoryUpdatePacket implements IIncomingPacket {
    readonly opcode = 0x19;
    private data!: InventoryUpdateData;

    decode(reader: IPacketReader): this {
        const changeCount = reader.readInt16LE();
        const changes: InventoryChange[] = [];

        for (let i = 0; i < changeCount; i++) {
            const changeType = reader.readUInt16LE(); // 1=ADD, 2=UPDATE, 3=REMOVE
            
            // Standard Interlude ItemInfo structure (34 bytes)
            const itemType1 = reader.readUInt16LE();
            const objectId = reader.readInt32LE();
            const itemId = reader.readInt32LE();
            const count = reader.readInt32LE();
            const itemType2 = reader.readUInt16LE();
            const customType1 = reader.readUInt16LE();
            const isEquipped = reader.readUInt16LE() !== 0;
            const bodyPart = reader.readInt32LE();
            const enchantLevel = reader.readUInt16LE();
            const customType2 = reader.readUInt16LE();
            const augmentationId = reader.readInt32LE();
            const mana = reader.readInt32LE();

            let changeTypeStr: InventoryChangeType;
            switch (changeType) {
                case 1: changeTypeStr = 'ADD'; break;
                case 2: changeTypeStr = 'UPDATE'; break;
                case 3: changeTypeStr = 'REMOVE'; break;
                default: changeTypeStr = 'UPDATE';
            }

            changes.push({
                changeType: changeTypeStr,
                objectId,
                itemId,
                count: count,
                slot: bodyPart,
                enchantLevel,
                isEquipped,
                itemType1,
                itemType2,
                customType1,
                customType2,
                augmentationId,
                mana,
            });
        }

        this.data = { changes };
        return this;
    }

    getData(): InventoryUpdateData {
        return { changes: [...this.data.changes] };
    }
}
