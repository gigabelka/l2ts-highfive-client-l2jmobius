import { describe, it, expect } from 'vitest';
import { PacketReader } from '../../../src/network/PacketReader';
import { PacketWriter } from '../../../src/network/PacketWriter';
import { 
    ItemListPacket, 
    SkillListPacket, 
    InventoryUpdatePacket 
} from '../../../src/infrastructure/protocol/game/packets';

describe('Fixed Packets Decoding (RangeError Fixes)', () => {
    describe('ItemListPacket', () => {
        it('should decode ItemList packet with 6 items (221 bytes total)', () => {
            const writer = new PacketWriter();
            writer.writeUInt8(0x1B); // opcode
            writer.writeUInt16LE(1); // showWindow
            writer.writeUInt16LE(6); // itemCount (H)
            
            // 6 items * 36 bytes = 216 bytes
            for (let i = 0; i < 6; i++) {
                writer.writeUInt16LE(1); // type1
                writer.writeInt32LE(1000 + i); // objectId
                writer.writeInt32LE(57); // itemId (Adena)
                writer.writeInt32LE(1000000); // count
                writer.writeUInt16LE(0); // type2
                writer.writeUInt16LE(0); // customType1
                writer.writeUInt16LE(0); // isEquipped
                writer.writeInt32LE(0); // bodyPart
                writer.writeUInt16LE(0); // enchant
                writer.writeUInt16LE(0); // customType2
                writer.writeInt32LE(0); // augmentation
                writer.writeInt32LE(-1); // mana
            }

            const buffer = writer.toBuffer();
            expect(buffer.length).toBe(221); // 1 + 220 = 221

            const packet = new ItemListPacket();
            // Simulate GamePacketProcessor behavior: skip 1 byte
            packet.decode(new PacketReader(buffer, 1));
            
            const data = packet.getData();
            expect(data.items.length).toBe(6);
            expect(data.items[0].objectId).toBe(1000);
            expect(data.items[5].objectId).toBe(1005);
        });
    });

    describe('SkillListPacket', () => {
        it('should decode SkillList packet with 39 skills (471 bytes total)', () => {
            const writer = new PacketWriter();
            writer.writeUInt8(0x58); // opcode
            writer.writeUInt16LE(39); // skillCount (H)
            
            // 39 skills * 12 bytes = 468 bytes
            for (let i = 0; i < 39; i++) {
                writer.writeInt32LE(0); // isPassive
                writer.writeInt32LE(1); // level
                writer.writeInt32LE(100 + i); // skillId
            }

            const buffer = writer.toBuffer();
            expect(buffer.length).toBe(471); // 1 + 470 = 471

            const packet = new SkillListPacket();
            // Simulate GamePacketProcessor behavior: skip 1 byte
            packet.decode(new PacketReader(buffer, 1));
            
            const data = packet.getData();
            expect(data.skills.length).toBe(39);
            expect(data.skills[0].skillId).toBe(100);
            expect(data.skills[38].skillId).toBe(138);
        });
    });

    describe('InventoryUpdatePacket', () => {
        it('should decode InventoryUpdate packet with correctly sized items', () => {
            const writer = new PacketWriter();
            writer.writeUInt8(0x19); // opcode
            writer.writeUInt16LE(1); // changeCount (H)
            
            // 1 item * 36 bytes + 2 bytes changeType = 38 bytes
            writer.writeUInt16LE(2); // changeType (UPDATE)
            
            writer.writeUInt16LE(1); // type1
            writer.writeInt32LE(12345); // objectId
            writer.writeInt32LE(57); // itemId
            writer.writeInt32LE(500000); // count
            writer.writeUInt16LE(0); // type2
            writer.writeUInt16LE(0); // customType1
            writer.writeUInt16LE(1); // isEquipped
            writer.writeInt32LE(0); // bodyPart
            writer.writeUInt16LE(5); // enchant
            writer.writeUInt16LE(0); // customType2
            writer.writeInt32LE(0); // augmentation
            writer.writeInt32LE(-1); // mana

            const buffer = writer.toBuffer();
            const packet = new InventoryUpdatePacket();
            // Simulate GamePacketProcessor behavior: skip 1 byte
            packet.decode(new PacketReader(buffer, 1));
            
            const data = packet.getData();
            expect(data.changes.length).toBe(1);
            expect(data.changes[0].changeType).toBe('UPDATE');
            expect(data.changes[0].objectId).toBe(12345);
            expect(data.changes[0].enchantLevel).toBe(5);
        });
    });
});
