/**
 * Словарь названий классов (classId → название)
 * Interlude Chronicle - все 118+ классов
 */

export const CLASS_NAMES: Record<number, string> = {
    // === Human Fighter (0-2) ===
    0: 'Human Fighter',
    1: 'Warrior',
    2: 'Gladiator',
    3: 'Warlord',
    4: 'Knight',
    5: 'Paladin',
    6: 'Dark Avenger',
    7: 'Rogue',
    8: 'Treasure Hunter',
    9: 'Hawkeye',

    // === Human Mystic (10-13) ===
    10: 'Human Mystic',
    11: 'Human Wizard',
    12: 'Sorcerer',
    13: 'Necromancer',
    14: 'Warlock',
    15: 'Cleric',
    16: 'Bishop',
    17: 'Prophet',

    // === Elven Fighter (18-24) ===
    18: 'Elven Fighter',
    19: 'Elven Knight',
    20: 'Temple Knight',
    21: 'Swordsinger',
    22: 'Elven Scout',
    23: 'Plainswalker',
    24: 'Silver Ranger',

    // === Elven Mystic (25-29) ===
    25: 'Elven Mystic',
    26: 'Elven Wizard',
    27: 'Spellsinger',
    28: 'Elemental Summoner',
    29: 'Elven Oracle',
    30: 'Elven Elder',

    // === Dark Elven Fighter (31-36) ===
    31: 'Dark Fighter',
    32: 'Palus Knight',
    33: 'Shillien Knight',
    34: 'Bladedancer',
    35: 'Assassin',
    36: 'Abyss Walker',
    37: 'Phantom Ranger',

    // === Dark Elven Mystic (38-42) ===
    38: 'Dark Mystic',
    39: 'Dark Wizard',
    40: 'Spellhowler',
    41: 'Phantom Summoner',
    42: 'Shillien Oracle',
    43: 'Shillien Elder',

    // === Orc Fighter (44-48) ===
    44: 'Orc Fighter',
    45: 'Orc Raider',
    46: 'Destroyer',
    47: 'Orc Monk',
    48: 'Tyrant',

    // === Orc Mystic (49-52) ===
    49: 'Orc Mystic',
    50: 'Orc Shaman',
    51: 'Overlord',
    52: 'Warcryer',

    // === Dwarf Fighter (53-55) ===
    53: 'Dwarven Fighter',
    54: 'Scavenger',
    55: 'Bounty Hunter',
    56: 'Artisan',
    57: 'Warsmith',

    // === Human 3rd Professions (88-94) ===
    88: 'Duelist',
    89: 'Dreadnought',
    90: 'Phoenix Knight',
    91: 'Hell Knight',
    92: 'Sagittarius',
    93: 'Adventurer',
    94: 'Archmage',
    95: 'Soultaker',
    96: 'Arcana Lord',
    97: 'Cardinal',
    98: 'Hierophant',

    // === Elf 3rd Professions (99-106) ===
    99: 'Eva\'s Templar',
    100: 'Sword Muse',
    101: 'Wind Rider',
    102: 'Moonlight Sentinel',
    103: 'Mystic Muse',
    104: 'Elemental Master',
    105: 'Eva\'s Saint',

    // === Dark Elf 3rd Professions (106-112) ===
    106: 'Shillien Templar',
    107: 'Spectral Dancer',
    108: 'Ghost Hunter',
    109: 'Ghost Sentinel',
    110: 'Storm Screamer',
    111: 'Spectral Master',
    112: 'Shillien Saint',

    // === Orc 3rd Professions (113-116) ===
    113: 'Titan',
    114: 'Grand Khavatari',
    115: 'Dominator',
    116: 'Doomcryer',

    // === Dwarf 3rd Professions (117-118) ===
    117: 'Fortune Seeker',
    118: 'Maestro',

    // === Kamael (Interlude) ===
    123: 'Kamael Male Soldier',
    124: 'Kamael Female Soldier',
    125: 'Trooper',
    126: 'Warder',
    127: 'Berserker',
    128: 'Soul Breaker',
    129: 'Soul Breaker (F)',
    130: 'Arbalester',
    131: 'Doombringer',
    132: 'Soul Hound',
    133: 'Soul Hound (F)',
    134: 'Trickster',
    135: 'Inspector',
    136: 'Judicator',
};

/**
 * Получить название класса по ID
 * @param id - classId
 * @returns Название класса или "Unknown Class #id"
 */
export function getClassName(id: number): string {
    return CLASS_NAMES[id] ?? `Unknown Class #${id}`;
}
