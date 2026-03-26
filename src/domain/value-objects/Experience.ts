/**
 * @fileoverview Experience - Value Object для опыта и уровней
 * @module domain/value-objects
 */



// Таблица опыта для Interlude (уровни 1-80)
const EXP_TABLE: number[] = [
    0, 0, 68, 363, 1168, 2994, 6374, 12133, 20914, 33615,
    50777, 73725, 103136, 139764, 184984, 240269, 307297, 387973,
    484431, 598074, 731670, 887268, 1069125, 1283445, 1535565,
    1830000, 2172180, 2568330, 3024560, 3548030, 4146950, 4830800,
    5610660, 6498520, 7507460, 8652710, 9950780, 11420700, 13096640,
    15000000, 17156580, 19594200, 22342890, 25436100, 28910550,
    32806200, 37166000, 42036000, 47466000, 53510000, 60236000,
    67685800, 75887700, 84883300, 94718200, 105441000, 116876000,
    129546000, 143508000, 158820000, 175542000, 193734000, 213458000,
    234776000, 257752000, 282450000, 308938000, 337282000, 367554000,
    399826000, 434172000, 470668000, 509392000, 550423000, 593842000,
    639734000, 688186000, 739287000, 793128000, 849802000, 909404000
];

export interface ExperienceData {
    level: number;
    exp: number;
    sp: number;
}

/**
 * Value Object для опыта и уровня персонажа
 */
export class Experience {
    readonly level: number;
    readonly exp: number;
    readonly sp: number;

    constructor(data: ExperienceData) {
        this.level = Math.max(1, Math.min(80, data.level));
        this.exp = Math.max(0, data.exp);
        this.sp = Math.max(0, data.sp);
    }

    /**
     * Factory method
     */
    static create(level: number, exp: number, sp: number): Experience {
        return new Experience({ level, exp, sp });
    }

    /**
     * Начальный опыт (уровень 1)
     */
    static starting(): Experience {
        return new Experience({ level: 1, exp: 0, sp: 0 });
    }

    /**
     * Опыт для конкретного уровня
     */
    static expForLevel(level: number): number {
        if (level < 1) return 0;
        if (level < EXP_TABLE.length) {
            return EXP_TABLE[level]!;
        }
        return Math.floor(Math.pow(level, 3.5) * 50);
    }

    /**
     * Опыт, необходимый для следующего уровня
     */
    get expForNextLevel(): number {
        return Experience.expForLevel(this.level + 1);
    }

    /**
     * Опыт, полученный на текущем уровне
     */
    get expInCurrentLevel(): number {
        return this.exp - Experience.expForLevel(this.level);
    }

    /**
     * Опыт, необходимый для апгрейда на этом уровне
     */
    get expNeededForLevel(): number {
        return this.expForNextLevel - Experience.expForLevel(this.level);
    }

    /**
     * Процент прогресса текущего уровня
     */
    get levelProgressPercent(): number {
        const needed = this.expNeededForLevel;
        return needed > 0 ? (this.expInCurrentLevel / needed) * 100 : 0;
    }

    /**
     * Можно ли повысить уровень
     */
    get canLevelUp(): boolean {
        return this.level < 80 && this.exp >= this.expForNextLevel;
    }

    /**
     * Добавить опыт
     */
    addExp(amount: number): Experience {
        return new Experience({
            level: this.level,
            exp: this.exp + amount,
            sp: this.sp
        });
    }

    /**
     * Добавить SP
     */
    addSp(amount: number): Experience {
        return new Experience({
            level: this.level,
            exp: this.exp,
            sp: this.sp + amount
        });
    }

    /**
     * Повысить уровень (если возможно)
     */
    levelUp(): Experience {
        if (!this.canLevelUp) return this;
        return new Experience({
            level: this.level + 1,
            exp: this.exp,
            sp: this.sp
        });
    }

    toJSON(): ExperienceData {
        return {
            level: this.level,
            exp: this.exp,
            sp: this.sp
        };
    }

    toString(): string {
        return `Level ${this.level} (${this.levelProgressPercent.toFixed(1)}%) - ${this.exp} EXP, ${this.sp} SP`;
    }
}

export class ExperienceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ExperienceError';
    }
}
