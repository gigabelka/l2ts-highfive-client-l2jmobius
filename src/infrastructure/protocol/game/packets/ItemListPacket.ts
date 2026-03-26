/**
 * @fileoverview ItemListPacket - DTO для пакета ItemList (0x1B)
 * Полный список предметов в инвентаре
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface ItemData {
    objectId: number;
    itemId: number;
    slot: number;
    count: number;
    enchantLevel: number;
    isEquipped: boolean;
    itemType: number;
    customType1: number;
    customType2: number;
    itemType2: number;
    augmentationId: number;
    mana: number;
}

export interface ItemListData {
    showWindow: boolean;
    adena: number;
    items: ItemData[];
}

/**
 * Пакет ItemList (0x1B)
 * Отправляется при открытии инвентаря
 */
export class ItemListPacket implements IIncomingPacket {
    readonly opcode = 0x1B;
    private data!: ItemListData;

    decode(reader: IPacketReader): this {
        const showWindow = reader.readInt16LE() !== 0;
        const itemCount = reader.readUInt16LE();
        
        const items: ItemData[] = [];
        
        for (let i = 0; i < itemCount; i++) {
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
            
            items.push({
                objectId,
                itemId,
                slot: bodyPart, // slot is bodyPart in this context
                count: count,
                enchantLevel,
                isEquipped,
                itemType: itemType1,
                customType1,
                customType2,
                itemType2,
                augmentationId,
                mana,
            });
        }

        let adena = 0;
        if (reader.remaining() >= 4) {
            // Adena is usually at the end of the packet or in a specific slot
            // If there's remaining data, it might be the adena count
        }

        this.data = {
            showWindow,
            adena,
            items,
        };

        return this;
    }

    getData(): ItemListData {
        return { ...this.data, items: [...this.data.items] };
    }
}
