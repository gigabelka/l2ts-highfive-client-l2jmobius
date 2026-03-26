import { describe, it, expect } from 'vitest';
import { PacketReader } from '../../../src/network/PacketReader';
import { PacketWriter } from '../../../src/network/PacketWriter';
import { 
    UserInfoPacket, 
    NpcInfoPacket, 
    CharInfoPacket 
} from '../../../src/infrastructure/protocol/game/packets';

describe('Packet Encoding/Decoding', () => {
    describe('UserInfoPacket', () => {
        it('should decode UserInfo packet', () => {
            const writer = new PacketWriter();
            // Note: opcode is passed separately, not in buffer
            writer.writeInt32LE(100); // x
            writer.writeInt32LE(200); // y
            writer.writeInt32LE(-300); // z
            writer.writeInt32LE(0); // vehicleId
            writer.writeInt32LE(12345); // objectId
            
            // Name as UTF-16LE with null terminator
            const nameBuffer = Buffer.from('TestPlayer\0', 'utf16le');
            writer.writeBytes(nameBuffer.slice(0, -2)); // Remove null, writer adds it
            writer.writeUInt16LE(0); // null terminator
            
            writer.writeInt32LE(0); // race
            writer.writeInt32LE(0); // sex
            writer.writeInt32LE(92); // classId (Adventurer)
            writer.writeInt32LE(80); // level
            writer.writeInt64LE(BigInt(1000000)); // exp
            
            // Stats
            writer.writeInt32LE(40); // str
            writer.writeInt32LE(35); // dex
            writer.writeInt32LE(30); // con
            writer.writeInt32LE(21); // int
            writer.writeInt32LE(20); // wit
            writer.writeInt32LE(10); // men
            
            // Vitals
            writer.writeInt32LE(5000); // maxHp
            writer.writeInt32LE(4500); // currentHp
            writer.writeInt32LE(1000); // maxMp
            writer.writeInt32LE(800); // currentMp
            
            // CP
            writer.writeInt32LE(2000); // maxCp
            writer.writeInt32LE(2000); // currentCp
            
            writer.writeInt32LE(500000); // sp
            writer.writeInt32LE(100); // currentLoad
            writer.writeInt32LE(1000); // maxLoad

            const buffer = writer.toBuffer();
            const packet = new UserInfoPacket();
            packet.decode(new PacketReader(buffer));

            const data = packet.getData();
            expect(data.objectId).toBe(12345);
            expect(data.x).toBe(100);
            expect(data.y).toBe(200);
            expect(data.z).toBe(-300);
            expect(data.level).toBe(80);
            expect(data.classId).toBe(92);
        });
    });

    describe('NpcInfoPacket', () => {
        it('should decode NpcInfo packet', () => {
            const writer = new PacketWriter();
            // Note: opcode is passed separately, not in buffer
            writer.writeInt32LE(99999); // objectId
            writer.writeInt32LE(20101 | 0x80000000); // npcId + attackable flag
            writer.writeInt32LE(500); // x
            writer.writeInt32LE(600); // y
            writer.writeInt32LE(-100); // z
            writer.writeInt32LE(0); // heading
            
            // Skip speeds (16 bytes)
            for (let i = 0; i < 4; i++) {
                writer.writeInt32LE(100);
            }
            // Float speeds
            for (let i = 0; i < 4; i++) {
                writer.writeDouble(100.0);
            }
            
            writer.writeUInt8(0); // isDead
            
            // Name
            const nameBuffer = Buffer.from('Orc\0', 'utf16le');
            writer.writeBytes(nameBuffer.slice(0, -2));
            writer.writeUInt16LE(0);
            
            // Title (empty)
            writer.writeUInt16LE(0);
            
            // Level
            writer.writeInt32LE(15);

            const buffer = writer.toBuffer();
            const packet = new NpcInfoPacket();
            packet.decode(new PacketReader(buffer));

            const data = packet.getData();
            expect(data.objectId).toBe(99999);
            expect(data.npcId).toBe(20101);
            expect(data.attackable).toBe(true);
            expect(data.x).toBe(500);
            expect(data.y).toBe(600);
            expect(data.level).toBe(15);
        });
    });

    describe('CharInfoPacket', () => {
        it('should decode CharInfo packet', () => {
            const writer = new PacketWriter();
            // Note: opcode is passed separately, not in buffer
            writer.writeInt32LE(300); // x
            writer.writeInt32LE(400); // y
            writer.writeInt32LE(-200); // z
            writer.writeInt32LE(45); // heading
            writer.writeInt32LE(88888); // objectId
            
            // Name
            const nameBuffer = Buffer.from('OtherPlayer\0', 'utf16le');
            writer.writeBytes(nameBuffer.slice(0, -2));
            writer.writeUInt16LE(0);
            
            writer.writeInt32LE(0); // race
            writer.writeInt32LE(1); // sex (female)
            writer.writeInt32LE(94); // classId (Hawkeye)
            
            // Equipment (10 slots)
            for (let i = 0; i < 10; i++) {
                writer.writeInt32LE(0);
            }
            
            writer.writeUInt8(1); // isRunning
            writer.writeUInt8(0); // isInCombat
            writer.writeUInt8(0); // isDead
            
            // Title
            writer.writeUInt16LE(0);
            
            // Speeds
            writer.writeInt32LE(120); // runSpeed
            writer.writeInt32LE(80); // walkSpeed
            writer.writeInt32LE(50); // swimRunSpeed
            writer.writeInt32LE(30); // swimWalkSpeed
            writer.writeInt32LE(0); // flyRunSpeed
            writer.writeInt32LE(0); // flyWalkSpeed
            // Floats as doubles for simplicity
            writer.writeDouble(1.0);
            writer.writeDouble(1.0);
            writer.writeDouble(0.9);
            writer.writeDouble(1.8);
            
            // Level
            writer.writeInt32LE(75);

            const buffer = writer.toBuffer();
            const packet = new CharInfoPacket();
            packet.decode(new PacketReader(buffer));

            const data = packet.getData();
            expect(data.objectId).toBe(88888);
            expect(data.x).toBe(300);
            expect(data.y).toBe(400);
            expect(data.sex).toBe(1);
            expect(data.classId).toBe(94);
            expect(data.isRunning).toBe(true);
        });
    });
});
