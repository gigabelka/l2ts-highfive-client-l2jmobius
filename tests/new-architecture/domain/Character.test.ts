import { describe, it, expect, beforeEach } from 'vitest';
import { Character, type CharacterData } from '../../../src/domain/entities';
import { Position, Vitals, BaseStats, CombatStats } from '../../../src/domain/value-objects';
import { ObjectId } from '../../../src/domain/value-objects';

describe('Character Entity', () => {
    let character: Character;

    beforeEach(() => {
        const data: CharacterData = {
            objectId: 12345,
            name: 'TestCharacter',
            title: '',
            level: 80,
            exp: 1000000,
            sp: 500000,
            classId: 92, // Adventurer
            raceId: 0, // Human
            sex: 0, // Male
            position: Position.at(100, 200, -300),
            hp: Vitals.full(5000),
            mp: Vitals.full(1000),
            cp: Vitals.full(2000),
            baseStats: BaseStats.create({ str: 40, dex: 35, con: 30 }),
            combatStats: CombatStats.create({ pAtk: 500, pDef: 400 }),
            skills: [],
            isInCombat: false,
        };
        character = Character.create(data);
    });

    it('should create character with correct properties', () => {
        expect(character.name).toBe('TestCharacter');
        expect(character.level).toBe(80);
        expect(character.id).toBe(12345);
    });

    it('should update position and emit event', () => {
        const newPos = Position.at(150, 250, -300);
        character.updatePosition(newPos, 100, true);

        expect(character.position.x).toBe(150);

        const events = character.getUncommittedEvents();
        expect(events.length).toBe(1);
        expect(events[0].type).toBe('character.position_changed');
    });

    it('should update HP and emit event', () => {
        character.updateHp(4000, 5000);

        expect(character.hp.current).toBe(4000);

        const events = character.getUncommittedEvents();
        const hpEvents = events.filter(e => e.type === 'character.stats_changed');
        expect(hpEvents.length).toBe(1);
    });

    it('should set target and emit event', () => {
        character.setTarget(99999, 'TestMob', 'NPC');

        expect(character.targetId).toBe(99999);

        const events = character.getUncommittedEvents();
        const targetEvents = events.filter(e => e.type === 'character.target_changed');
        expect(targetEvents.length).toBe(1);
    });

    it('should clear uncommitted events', () => {
        character.updateHp(3000, 5000);
        expect(character.getUncommittedEvents().length).toBeGreaterThan(0);

        character.clearUncommittedEvents();
        expect(character.getUncommittedEvents().length).toBe(0);
    });

    it('should be immutable from outside', () => {
        const skills = character.skills;
        // skills is readonly array, can't push
        expect(() => (skills as any).push({ id: 1 })).toThrow();
    });
});
