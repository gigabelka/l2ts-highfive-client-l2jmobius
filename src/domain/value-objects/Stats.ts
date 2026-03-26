/**
 * @fileoverview Stats - Value Object для характеристик персонажа
 * @module domain/value-objects
 */

export interface CharacterStatsData {
    str: number;
    con: number;
    dex: number;
    int: number;
    wit: number;
    men: number;
}

export interface CombatStatsData {
    pAtk: number;
    mAtk: number;
    pDef: number;
    mDef: number;
    atkSpd: number;
    castSpd: number;
    accuracy: number;
    evasion: number;
    critical: number;
    speed: number;
}

/**
 * Базовые характеристики (STR, CON, DEX, INT, WIT, MEN)
 */
export class BaseStats implements CharacterStatsData {
    readonly str: number;
    readonly con: number;
    readonly dex: number;
    readonly int: number;
    readonly wit: number;
    readonly men: number;

    constructor(data: CharacterStatsData) {
        this.str = Math.max(1, data.str);
        this.con = Math.max(1, data.con);
        this.dex = Math.max(1, data.dex);
        this.int = Math.max(1, data.int);
        this.wit = Math.max(1, data.wit);
        this.men = Math.max(1, data.men);
    }

    static create(data: Partial<CharacterStatsData>): BaseStats {
        return new BaseStats({
            str: data.str ?? 1,
            con: data.con ?? 1,
            dex: data.dex ?? 1,
            int: data.int ?? 1,
            wit: data.wit ?? 1,
            men: data.men ?? 1
        });
    }

    static default(): BaseStats {
        return new BaseStats({ str: 10, con: 10, dex: 10, int: 10, wit: 10, men: 10 });
    }

    toJSON(): CharacterStatsData {
        return {
            str: this.str,
            con: this.con,
            dex: this.dex,
            int: this.int,
            wit: this.wit,
            men: this.men
        };
    }
}

/**
 * Боевые характеристики
 */
export class CombatStats implements CombatStatsData {
    readonly pAtk: number;
    readonly mAtk: number;
    readonly pDef: number;
    readonly mDef: number;
    readonly atkSpd: number;
    readonly castSpd: number;
    readonly accuracy: number;
    readonly evasion: number;
    readonly critical: number;
    readonly speed: number;

    constructor(data: CombatStatsData) {
        this.pAtk = data.pAtk;
        this.mAtk = data.mAtk;
        this.pDef = data.pDef;
        this.mDef = data.mDef;
        this.atkSpd = data.atkSpd;
        this.castSpd = data.castSpd;
        this.accuracy = data.accuracy;
        this.evasion = data.evasion;
        this.critical = data.critical;
        this.speed = data.speed;
    }

    static create(data: Partial<CombatStatsData>): CombatStats {
        return new CombatStats({
            pAtk: data.pAtk ?? 0,
            mAtk: data.mAtk ?? 0,
            pDef: data.pDef ?? 0,
            mDef: data.mDef ?? 0,
            atkSpd: data.atkSpd ?? 0,
            castSpd: data.castSpd ?? 0,
            accuracy: data.accuracy ?? 0,
            evasion: data.evasion ?? 0,
            critical: data.critical ?? 0,
            speed: data.speed ?? 0
        });
    }

    toJSON(): CombatStatsData {
        return {
            pAtk: this.pAtk,
            mAtk: this.mAtk,
            pDef: this.pDef,
            mDef: this.mDef,
            atkSpd: this.atkSpd,
            castSpd: this.castSpd,
            accuracy: this.accuracy,
            evasion: this.evasion,
            critical: this.critical,
            speed: this.speed
        };
    }
}
