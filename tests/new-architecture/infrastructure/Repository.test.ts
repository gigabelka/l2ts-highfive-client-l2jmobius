import { describe, it, expect, beforeEach } from 'vitest';
import {
    InMemoryCharacterRepository,
    InMemoryWorldRepository,
    InMemoryInventoryRepository,
} from '../../../src/infrastructure/persistence';
import { Character } from '../../../src/domain/entities';
import { Npc } from '../../../src/domain/entities';
import { InventoryItem } from '../../../src/domain/entities';
import { Position, Vitals, BaseStats, CombatStats } from '../../../src/domain/value-objects';

describe('InMemory Repositories', () => {
    describe('CharacterRepository', () => {
        let repo: InMemoryCharacterRepository;

        beforeEach(() => {
            repo = new InMemoryCharacterRepository();
        });

        it('should save and retrieve character', () => {
            const char = createTestCharacter();
            repo.save(char);

            const retrieved = repo.get();
            expect(retrieved).not.toBeNull();
            expect(retrieved!.name).toBe(char.name);
        });

        it('should return null when no character', () => {
            expect(repo.get()).toBeNull();
            expect(repo.exists()).toBe(false);
        });

        it('should update character', () => {
            const char = createTestCharacter();
            repo.save(char);

            repo.update((c) => {
                c.updateHp(100, 1000);
                return c;
            });

            const updated = repo.get();
            expect(updated!.hp.current).toBe(100);
        });

        it('should return error when updating non-existent character', () => {
            const result = repo.update((c) => c);
            expect(result.isErr()).toBe(true);
        });

        it('should collect events and clear them', () => {
            const char = createTestCharacter();
            repo.save(char);

            repo.update((c) => {
                c.updatePosition(Position.at(50, 50, 0), 100, true);
                return c;
            });

            const events = repo.collectEvents();
            expect(events.length).toBeGreaterThan(0);
            expect(repo.collectEvents().length).toBe(0); // Cleared
        });
    });

    describe('WorldRepository', () => {
        let repo: InMemoryWorldRepository;

        beforeEach(() => {
            repo = new InMemoryWorldRepository();
        });

        it('should save and retrieve NPC', () => {
            const npc = createTestNpc();
            repo.saveNpc(npc);

            const retrieved = repo.getNpc(npc.id);
            expect(retrieved).not.toBeUndefined();
            expect(retrieved!.name).toBe(npc.name);
        });

        it('should find nearby NPCs', () => {
            const playerPos = Position.at(0, 0, 0);
            
            // NPC near player
            const nearNpc = createTestNpc(1, 'Near', 100, 0, 0);
            repo.saveNpc(nearNpc);

            // NPC far from player
            const farNpc = createTestNpc(2, 'Far', 1000, 1000, 0);
            repo.saveNpc(farNpc);

            const nearby = repo.getNearbyNpcs(playerPos, 500);
            expect(nearby.length).toBe(1);
            expect(nearby[0].name).toBe('Near');
            expect(nearby[0].distance).toBe(100);
        });

        it('should filter NPCs by criteria', () => {
            const playerPos = Position.at(0, 0, 0);
            
            const attackableNpc = createTestNpc(1, 'Attackable', 100, 0, 0);
            repo.saveNpc(attackableNpc);

            // TODO: Add non-attackable NPC when we have that capability

            const nearby = repo.getNearbyNpcs(playerPos, 500, { attackable: true });
            expect(nearby.length).toBe(1);
        });

        it('should remove NPC', () => {
            const npc = createTestNpc();
            repo.saveNpc(npc);
            
            expect(repo.removeNpc(npc.id)).toBe(true);
            expect(repo.getNpc(npc.id)).toBeUndefined();
            expect(repo.removeNpc(99999)).toBe(false);
        });
    });

    describe('InventoryRepository', () => {
        let repo: InMemoryInventoryRepository;

        beforeEach(() => {
            repo = new InMemoryInventoryRepository();
        });

        it('should manage adena', () => {
            repo.updateAdena(1000);
            expect(repo.getAdena()).toBe(1000);

            const addResult = repo.addAdena(500);
            expect(addResult.isOk()).toBe(true);
            expect(repo.getAdena()).toBe(1500);
        });

        it('should reject negative adena removal', () => {
            repo.updateAdena(100);
            const result = repo.removeAdena(200);
            expect(result.isErr()).toBe(true);
        });

        it('should manage items', () => {
            const item = createTestItem();
            repo.addOrUpdateItem(item);

            const retrieved = repo.getItem(item.id);
            expect(retrieved).not.toBeUndefined();
            expect(retrieved!.name).toBe(item.name);
        });

        it('should get equipped items', () => {
            const equippedItem = createTestItem(1, 'Sword', true);
            const unequippedItem = createTestItem(2, 'Potion', false);

            repo.addOrUpdateItem(equippedItem);
            repo.addOrUpdateItem(unequippedItem);

            const equipped = repo.getEquippedItems();
            expect(equipped.length).toBe(1);
            expect(equipped[0].name).toBe('Sword');
        });

        it('should equip and unequip items', () => {
            const item = createTestItem(1, 'Armor', false);
            repo.addOrUpdateItem(item);

            const equipResult = repo.equipItem(item.id);
            expect(equipResult.isOk()).toBe(true);
            expect(repo.getItem(item.id)!.equipped).toBe(true);

            const unequipResult = repo.unequipItem(item.id);
            expect(unequipResult.isOk()).toBe(true);
            expect(repo.getItem(item.id)!.equipped).toBe(false);
        });
    });
});

// Test helpers
function createTestCharacter(): Character {
    return Character.create({
        objectId: 12345,
        name: 'TestChar',
        title: '',
        level: 1,
        exp: 0,
        sp: 0,
        classId: 0,
        raceId: 0,
        sex: 0,
        position: Position.zero(),
        hp: Vitals.full(100),
        mp: Vitals.full(100),
        cp: Vitals.zero(),
        baseStats: BaseStats.create({ str: 10, dex: 10, con: 10, int: 10, wit: 10, men: 10 }),
        combatStats: CombatStats.create({ pAtk: 0, mAtk: 0, pDef: 0, mDef: 0, atkSpd: 0, castSpd: 0, accuracy: 0, evasion: 0, critical: 0, speed: 0 }),
        skills: [],
        isInCombat: false,
    });
}

function createTestNpc(id = 1, name = 'TestNpc', x = 0, y = 0, z = 0): ReturnType<typeof Npc.create> {
    return Npc.create({
        objectId: id,
        npcId: id * 1000,
        name,
        level: 10,
        position: Position.at(x, y, z),
        hp: Vitals.full(500),
        isAttackable: true,
        isAggressive: false,
    });
}

function createTestItem(id = 1, name = 'TestItem', equipped = false): InventoryItem {
    return InventoryItem.create({
        objectId: id,
        itemId: id * 100,
        name,
        count: 1,
        type: 'weapon',
        equipped,
        slot: 0,
        enchant: 0,
        mana: 0,
    });
}
