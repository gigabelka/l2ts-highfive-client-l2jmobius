import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PacketReader } from '../../../src/network/PacketReader';
import { PacketWriter } from '../../../src/network/PacketWriter';
import { SimpleEventBus } from '../../../src/infrastructure/event-bus';
import { InMemoryCharacterRepository, InMemoryWorldRepository } from '../../../src/infrastructure/persistence';
import { UserInfoHandler, NpcInfoHandler, CharInfoHandler } from '../../../src/infrastructure/protocol/game/handlers';
import { Position, Vitals, BaseStats, CombatStats } from '../../../src/domain/value-objects';
import { Npc, Character } from '../../../src/domain/entities';

describe('Packet Handlers', () => {
    let eventBus: SimpleEventBus;
    let charRepo: InMemoryCharacterRepository;
    let worldRepo: InMemoryWorldRepository;

    beforeEach(() => {
        eventBus = new SimpleEventBus();
        charRepo = new InMemoryCharacterRepository();
        worldRepo = new InMemoryWorldRepository();
    });

    describe('UserInfoHandler', () => {
        it('should create character on first UserInfo', () => {
            const handler = new UserInfoHandler(eventBus, charRepo);
            const eventSpy = vi.fn();
            eventBus.subscribe('character.entered_game', eventSpy);

            const buffer = createUserInfoBuffer({
                objectId: 12345,
                name: 'TestPlayer',
                level: 80,
                x: 100, y: 200, z: -300,
                currentHp: 4500, maxHp: 5000,
                currentMp: 800, maxMp: 1000,
            });

            handler.handle(
                { opcode: 0x04, state: 'WAIT_USER_INFO', timestamp: Date.now(), rawBody: buffer },
                new PacketReader(buffer)
            );

            // Check repository
            const character = charRepo.get();
            expect(character).not.toBeNull();
            expect(character!.name).toBe('TestPlayer');
            expect(character!.level).toBe(80);
            expect(character!.position.x).toBe(100);

            // Check event was emitted
            expect(eventSpy).toHaveBeenCalled();
        });

        it('should update existing character', () => {
            // Create initial character
            charRepo.save(Character.create({
                objectId: 12345,
                name: 'TestPlayer',
                level: 1,
                exp: 0,
                sp: 0,
                classId: 0,
                raceId: 0,
                sex: 0,
                title: '',
                position: Position.zero(),
                hp: Vitals.create({ current: 100, max: 100 }).getOrElse(Vitals.zero()),
                mp: Vitals.create({ current: 100, max: 100 }).getOrElse(Vitals.zero()),
                cp: Vitals.create({ current: 0, max: 0 }).getOrElse(Vitals.zero()),
                baseStats: BaseStats.create({ str: 10, dex: 10, con: 10, int: 10, wit: 10, men: 10 }),
                combatStats: CombatStats.create({}),
                skills: [],
                isInCombat: false,
            } as any));

            const handler = new UserInfoHandler(eventBus, charRepo);

            const buffer = createUserInfoBuffer({
                objectId: 12345,
                name: 'TestPlayer',
                level: 80,
                x: 500, y: 600, z: -100,
            });

            handler.handle(
                { opcode: 0x04, state: 'IN_GAME', timestamp: Date.now(), rawBody: buffer },
                new PacketReader(buffer)
            );

            const character = charRepo.get();
            expect(character!.level).toBe(80);
        });
    });

    describe('NpcInfoHandler', () => {
        it('should spawn new NPC', () => {
            const handler = new NpcInfoHandler(eventBus, worldRepo);
            const eventSpy = vi.fn();
            eventBus.subscribe('world.npc_spawned', eventSpy);

            const buffer = createNpcInfoBuffer({
                objectId: 99999,
                npcId: 20101,
                name: 'Orc',
                level: 15,
                x: 500, y: 600, z: -100,
                attackable: true,
            });

            handler.handle(
                { opcode: 0x16, state: 'IN_GAME', timestamp: Date.now(), rawBody: buffer },
                new PacketReader(buffer)
            );

            // Check repository
            const npc = worldRepo.getNpc(99999);
            expect(npc).not.toBeUndefined();
            expect(npc!.name).toBe('Orc');
            expect(npc!.isAttackable).toBe(true);

            // Check event
            expect(eventSpy).toHaveBeenCalled();
        });

        it('should update existing NPC position', () => {
            // Spawn NPC first

            const { npc } = Npc.spawn({
                objectId: 99999,
                npcId: 20101,
                name: 'Orc',
                level: 15,
                position: Position.at(100, 100, 0),
                hp: { current: 100, max: 100 } as any,
                isAttackable: true,
                isAggressive: false,
            });
            worldRepo.saveNpc(npc);

            const handler = new NpcInfoHandler(eventBus, worldRepo);

            // Update position
            const buffer = createNpcInfoBuffer({
                objectId: 99999,
                npcId: 20101,
                name: 'Orc',
                level: 15,
                x: 500, y: 600, z: -100,
                attackable: true,
            });

            handler.handle(
                { opcode: 0x16, state: 'IN_GAME', timestamp: Date.now(), rawBody: buffer },
                new PacketReader(buffer)
            );

            const updatedNpc = worldRepo.getNpc(99999);
            expect(updatedNpc!.position.x).toBe(500);
            expect(updatedNpc!.position.y).toBe(600);
        });
    });

    describe('CharInfoHandler', () => {
        it('should emit player spawned event', () => {
            const handler = new CharInfoHandler(eventBus, worldRepo);
            const eventSpy = vi.fn();
            eventBus.subscribe('world.player_spawned', eventSpy);

            const buffer = createCharInfoBuffer({
                objectId: 88888,
                name: 'OtherPlayer',
                level: 75,
                x: 300, y: 400, z: -200,
            });

            handler.handle(
                { opcode: 0x03, state: 'IN_GAME', timestamp: Date.now(), rawBody: buffer },
                new PacketReader(buffer)
            );

            expect(eventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'world.player_spawned',
                    payload: expect.objectContaining({
                        objectId: 88888,
                        name: 'OtherPlayer',
                        level: 75,
                    }),
                })
            );
        });
    });
});

// Test helpers
function createUserInfoBuffer(data: any): Buffer {
    const writer = new PacketWriter();
    // Note: opcode is passed separately
    writer.writeInt32LE(data.x ?? 0);
    writer.writeInt32LE(data.y ?? 0);
    writer.writeInt32LE(data.z ?? 0);
    writer.writeInt32LE(0); // vehicleId
    writer.writeInt32LE(data.objectId ?? 12345);
    
    // Name as UTF-16
    const name = data.name ?? 'Test';
    const nameBuf = Buffer.alloc((name.length + 1) * 2);
    nameBuf.write(name, 0, 'utf16le');
    writer.writeBytes(nameBuf);
    
    writer.writeInt32LE(0); // race
    writer.writeInt32LE(0); // sex
    writer.writeInt32LE(data.classId ?? 0);
    writer.writeInt32LE(data.level ?? 1);
    writer.writeInt64LE(BigInt(data.exp ?? 0));
    
    writer.writeInt32LE(data.str ?? 10);
    writer.writeInt32LE(data.dex ?? 10);
    writer.writeInt32LE(data.con ?? 10);
    writer.writeInt32LE(data.int ?? 10);
    writer.writeInt32LE(data.wit ?? 10);
    writer.writeInt32LE(data.men ?? 10);
    
    writer.writeInt32LE(data.maxHp ?? 100);
    writer.writeInt32LE(data.currentHp ?? 100);
    writer.writeInt32LE(data.maxMp ?? 100);
    writer.writeInt32LE(data.currentMp ?? 100);
    
    writer.writeInt32LE(data.sp ?? 0);
    
    return writer.toBuffer();
}

function createNpcInfoBuffer(data: any): Buffer {
    const writer = new PacketWriter();
    // Note: opcode is passed separately
    writer.writeInt32LE(data.objectId ?? 99999);
    writer.writeInt32LE((data.npcId ?? 20101) | (data.attackable ? 0x80000000 : 0));
    writer.writeInt32LE(data.x ?? 0);
    writer.writeInt32LE(data.y ?? 0);
    writer.writeInt32LE(data.z ?? 0);
    writer.writeInt32LE(0); // heading
    
    // Collision
    writer.writeInt32LE(10);
    writer.writeInt32LE(20);
    
    // Speeds (6 int32 + 4 float)
    for (let i = 0; i < 6; i++) {
        writer.writeInt32LE(100);
    }
    for (let i = 0; i < 4; i++) {
        writer.writeFloatLE(100);
    }
    
    writer.writeUInt8(0); // isDead
    
    // Name as UTF-16
    const name = data.name ?? 'NPC';
    const nameBuf = Buffer.alloc((name.length + 1) * 2);
    nameBuf.write(name, 0, 'utf16le');
    writer.writeBytes(nameBuf);
    
    // Title (empty)
    const titleBuf = Buffer.alloc(2);
    writer.writeBytes(titleBuf);
    
    writer.writeInt32LE(data.level ?? 1);
    
    return writer.toBuffer();
}

function createCharInfoBuffer(data: any): Buffer {
    const writer = new PacketWriter();
    // Note: opcode is passed separately, not in buffer
    writer.writeInt32LE(data.x ?? 0);
    writer.writeInt32LE(data.y ?? 0);
    writer.writeInt32LE(data.z ?? 0);
    writer.writeInt32LE(0); // heading
    writer.writeInt32LE(data.objectId ?? 88888);
    
    // Name as UTF-16 with null terminator
    const name = data.name ?? 'Player';
    const nameBuf = Buffer.alloc((name.length + 1) * 2);
    nameBuf.write(name, 0, 'utf16le');
    writer.writeBytes(nameBuf);
    
    writer.writeInt32LE(0); // race
    writer.writeInt32LE(0); // sex  
    writer.writeInt32LE(0); // classId
    
    // 10 equipment slots
    for (let i = 0; i < 10; i++) {
        writer.writeInt32LE(0);
    }
    
    writer.writeUInt8(1); // isRunning
    writer.writeUInt8(0); // isInCombat
    writer.writeUInt8(0); // isDead
    
    // Title (empty)
    const titleBuf = Buffer.alloc(2);
    writer.writeBytes(titleBuf);
    
    // 6 speeds (int32) + 4 floats
    for (let i = 0; i < 6; i++) {
        writer.writeInt32LE(100);
    }
    for (let i = 0; i < 4; i++) {
        writer.writeFloatLE(1.0);
    }
    
    writer.writeInt32LE(data.level ?? 1);
    
    return writer.toBuffer();
}
