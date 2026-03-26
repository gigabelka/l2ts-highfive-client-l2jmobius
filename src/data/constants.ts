/**
 * Lineage 2 Interlude Protocol Constants
 * Based on L2J Mobius CT_0_Interlude Protocol 746
 */

// ============ Class IDs ============
export enum ClassId {
  // Human Fighters
  FIGHTER = 0,
  WARRIOR = 1,
  GLADIATOR = 2,
  WARLORD = 3,
  KNIGHT = 4,
  PALADIN = 5,
  DARK_AVENGER = 6,
  ROGUE = 7,
  TREASURE_HUNTER = 8,
  HAWKEYE = 9,

  // Human Mages
  MAGE = 10,
  WIZARD = 11,
  SORCERER = 12,
  NECROMANCER = 13,
  WARLOCK = 14,
  CLERIC = 15,
  BISHOP = 16,
  PROPHET = 17,

  // Elves
  ELVEN_FIGHTER = 18,
  ELVEN_KNIGHT = 19,
  TEMPLE_KNIGHT = 20,
  SWORDSINGER = 21,
  ELVEN_SCOUT = 22,
  PLAINS_WALKER = 23,
  SILVER_RANGER = 24,
  ELVEN_MAGE = 25,
  ELVEN_WIZARD = 26,
  SPELLSINGER = 27,
  ELEMENTAL_SUMMONER = 28,
  ORACLE = 29,
  ELDER = 30,

  // Dark Elves
  DARK_FIGHTER = 31,
  PALUS_KNIGHT = 32,
  SHILLIEN_KNIGHT = 33,
  BLADEDANCER = 34,
  ASSASSIN = 35,
  ABYSS_WALKER = 36,
  PHANTOM_RANGER = 37,
  DARK_MAGE = 38,
  DARK_WIZARD = 39,
  SPELLHOWLER = 40,
  PHANTOM_SUMMONER = 41,
  SHILLIEN_ORACLE = 42,
  SHILLIEN_ELDER = 43,

  // Orcs
  ORC_FIGHTER = 44,
  ORC_RAIDER = 45,
  DESTROYER = 46,
  ORC_MONK = 47,
  TYRANT = 48,
  ORC_MAGE = 49,
  ORC_SHAMAN = 50,
  OVERLORD = 51,
  WARCRYER = 52,

  // Dwarves
  DWARVEN_FIGHTER = 53,
  SCAVENGER = 54,
  BOUNTY_HUNTER = 55,
  ARTISAN = 56,
  WARSMITH = 57,

  // Dummy entries for alignment (58-87)
  DUMMY_58 = 58, DUMMY_59 = 59, DUMMY_60 = 60, DUMMY_61 = 61,
  DUMMY_62 = 62, DUMMY_63 = 63, DUMMY_64 = 64, DUMMY_65 = 65,
  DUMMY_66 = 66, DUMMY_67 = 67, DUMMY_68 = 68, DUMMY_69 = 69,
  DUMMY_70 = 70, DUMMY_71 = 71, DUMMY_72 = 72, DUMMY_73 = 73,
  DUMMY_74 = 74, DUMMY_75 = 75, DUMMY_76 = 76, DUMMY_77 = 77,
  DUMMY_78 = 78, DUMMY_79 = 79, DUMMY_80 = 80, DUMMY_81 = 81,
  DUMMY_82 = 82, DUMMY_83 = 83, DUMMY_84 = 84, DUMMY_85 = 85,
  DUMMY_86 = 86, DUMMY_87 = 87,

  // 3rd Classes (Interlude extended)
  DUELIST = 88,
  DREADNOUGHT = 89,
  PHOENIX_KNIGHT = 90,
  HELL_KNIGHT = 91,
  SAGITTARIUS = 92,
  ADVENTURER = 93,
  ARCHMAGE = 94,
  SOULTAKER = 95,
  ARCANA_LORD = 96,
  CARDINAL = 97,
  HIEROPHANT = 98,

  EVA_TEMPLAR = 99,
  SWORD_MUSE = 100,
  WIND_RIDER = 101,
  MOONLIGHT_SENTINEL = 102,
  MYSTIC_MUSE = 103,
  ELEMENTAL_MASTER = 104,
  EVA_SAINT = 105,

  SHILLIEN_TEMPLAR = 106,
  SPECTRAL_DANCER = 107,
  GHOST_HUNTER = 108,
  GHOST_SENTINEL = 109,
  STORM_SCREAMER = 110,
  SPECTRAL_MASTER = 111,
  SHILLIEN_SAINT = 112,

  TITAN = 113,
  GRAND_KHAVATARI = 114,
  DOMINATOR = 115,
  DOOMCRYER = 116,

  FORTUNE_SEEKER = 117,
  MAESTRO = 118,
}

// ============ Race IDs ============
export enum RaceId {
  HUMAN = 0,
  ELF = 1,
  DARK_ELF = 2,
  ORC = 3,
  DWARF = 4,
  KAMAEL = 5,
}

// ============ Sex ============
export enum Sex {
  MALE = 0,
  FEMALE = 1,
}

// ============ Paperdoll Slots ============
export enum PaperdollSlot {
  UNDER = 0,
  REAR = 1,
  LEAR = 2,
  NECK = 3,
  RFINGER = 4,
  LFINGER = 5,
  HEAD = 6,
  RHAND = 7,
  LHAND = 8,
  GLOVES = 9,
  CHEST = 10,
  LEGS = 11,
  FEET = 12,
  BACK = 13,
  HAIR = 14,
  HAIR2 = 15,
}

// ============ Item Grades ============
export enum ItemGrade {
  NONE = 0,
  D = 1,
  C = 2,
  B = 3,
  A = 4,
  S = 5,
}

// ============ Item Types ============
export enum ItemType {
  WEAPON = 1,
  ARMOR = 2,
  CONSUMABLE = 3,
  MATERIAL = 4,
  QUEST = 5,
  ETC = 6,
}

// ============ Item Body Parts ============
export enum BodyPart {
  NONE = 0,
  CHEST = 1,
  LEGS = 2,
  FEET = 3,
  HEAD = 4,
  GLOVES = 5,
  RIGHT_HAND = 6,
  LEFT_HAND = 7,
  TWO_HAND = 8,
  ONE_HAND = 9,
  RIGHT_EAR = 10,
  LEFT_EAR = 11,
  RIGHT_FINGER = 12,
  LEFT_FINGER = 13,
  NECK = 14,
  FULL_ARMOR = 15,
  UNDERWEAR = 16,
  BACK = 17,
}

// ============ Game OpCodes (Server → Client) ============
export enum GameOpCode {
  CRYPT_INIT = 0x00,
  MOVE_TO_LOCATION = 0x01,
  CHAR_INFO = 0x03,
  USER_INFO = 0x04,
  ATTACK = 0x05,
  ATTACK_CANCELLED = 0x06,
  DIE = 0x07,
  REVIVE = 0x08,
  SPAWN_ITEM = 0x0B,
  DROP_ITEM = 0x0C,
  GET_ITEM = 0x0D,
  STATUS_UPDATE = 0x0E,
  NPC_INFO = 0x16,
  CHAR_SELECTION_INFO = 0x19,
  ITEM_LIST = 0x1B,
  SYSTEM_MESSAGE = 0x40,
  CHARACTER_SELECTED = 0x15,
  INVENTORY_UPDATE = 0x21,
  SKILL_LIST = 0x58,
  MAGIC_SKILL_USE = 0x48,
  SKILL_COOL_TIME = 0xC7,
  TARGET_SELECTED = 0x29,
  TARGET_UNSELECTED = 0x2A,
  MY_TARGET_SELECTED = 0xBF,
  ATTACKED = 0x3B,
  ATTACK_OUT_OF_RANGE = 0x3C,
  MOVE_TO_PAWN = 0x60,
  STOP_MOVE = 0x47,
  CREATURE_SAY = 0x4A,
  PARTY_SMALL_WINDOW_ALL = 0x4E,
  PARTY_SMALL_WINDOW_ADD = 0x4F,
  PARTY_SMALL_WINDOW_DELETE = 0x50,
  PARTY_SMALL_WINDOW_UPDATE = 0x51,
  PARTY_MEMBER_POSITION = 0xBA,
  QUEST_LIST = 0x80,
  PLEDGE_SHOW_INFO_UPDATE = 0x8E,
  ALLIANCE_INFO = 0xB4,
  FRIEND_LIST = 0xFB,
  HENNA_INFO = 0xE4,
  HENNA_ITEM_INFO = 0xE5,
  HENNA_EQUIP_INFO = 0xE6,
  SEND_MACRO_LIST = 0xE8,
  BUY_LIST = 0x11,
  SELL_LIST = 0x10,
  WEAR_LIST = 0xEF,
  PRIVATE_STORE_LIST = 0x9C,
  TRADE_START = 0x1E,
  TRADE_OWN_ADD = 0x20,
  TRADE_OTHER_ADD = 0x22,
  TRADE_DONE = 0x23,
  ABnormal_STATUS_UPDATE = 0x19, // eslint-disable-line @typescript-eslint/no-duplicate-enum-values
  SHORT_BUFF_STATUS_UPDATE = 0xF4,
  STOP_MOVE_WITH_LOCATION = 0x47, // eslint-disable-line @typescript-eslint/no-duplicate-enum-values
  NET_PING_REQUEST = 0xD3,
  SSQ_INFO = 0x73,
  PET_INFO = 0xB1,
  PET_ITEM_LIST = 0xB2,
  PET_STATUS_UPDATE = 0xB3,
  EX_SEND_MANOR_LIST = 0xFE, // Extended packet
}

// ============ Chat Channels ============
export enum ChatChannel {
  ALL = 0,
  SHOUT = 1,
  TELL = 2,
  PARTY = 3,
  CLAN = 4,
  GM = 5,
  PETITION_PLAYER = 6,
  PETITION_GM = 7,
  TRADE = 8,
  ALLIANCE = 9,
  ANNOUNCEMENT = 10,
  BOAT = 11,
  L2FRIEND = 12,
  MSNCHAT = 13,
  PARTYMATCH_ROOM = 14,
  PARTYROOM_COMMANDER = 15,
  PARTYROOM_ALL = 16,
}

// ============ NPC Types ============
export enum NpcType {
  NPC = 0,
  MONSTER = 1,
  BOSS = 2,
  GUARD = 3,
  MERCHANT = 4,
  TELEPORTER = 5,
  GATEKEEPER = 6,
  WAREHOUSE_KEEPER = 7,
  CLAN_HALL_MANAGER = 8,
  PET_MANAGER = 9,
  FISHERMAN = 10,
  MANOR_MANAGER = 11,
}

// ============ Status Update Types ============
export enum StatusUpdateType {
  LEVEL = 0x01,
  EXP = 0x02,
  STR = 0x03,
  DEX = 0x04,
  CON = 0x05,
  INT = 0x06,
  WIT = 0x07,
  MEN = 0x08,
  CUR_HP = 0x09,
  MAX_HP = 0x0A,
  CUR_MP = 0x0B,
  MAX_MP = 0x0C,
  CUR_LOAD = 0x0E,
  MAX_LOAD = 0x0F,
  P_ATK = 0x11,
  ATK_SPD = 0x12,
  P_DEF = 0x13,
  EVASION = 0x14,
  ACCURACY = 0x15,
  CRITICAL = 0x16,
  M_ATK = 0x17,
  CAST_SPD = 0x18,
  M_DEF = 0x19,
  CUR_CP = 0x21,
  MAX_CP = 0x22,
}

// ============ Skill Types ============
export enum SkillType {
  PASSIVE = 0,
  ACTIVE = 1,
  TOGGLE = 2,
  CHANCE = 3,
}

// ============ Enchant Effect Types ============
export enum EnchantEffectType {
  NONE = 0,
  BLESSED = 1,
  CRYSTAL = 2,
}

// ============ Maps for Human-Readable Names ============

export const ClassIdNames: Record<ClassId, string> = {
  [ClassId.FIGHTER]: 'Fighter',
  [ClassId.WARRIOR]: 'Warrior',
  [ClassId.GLADIATOR]: 'Gladiator',
  [ClassId.WARLORD]: 'Warlord',
  [ClassId.KNIGHT]: 'Knight',
  [ClassId.PALADIN]: 'Paladin',
  [ClassId.DARK_AVENGER]: 'Dark Avenger',
  [ClassId.ROGUE]: 'Rogue',
  [ClassId.TREASURE_HUNTER]: 'Treasure Hunter',
  [ClassId.HAWKEYE]: 'Hawkeye',
  [ClassId.MAGE]: 'Mage',
  [ClassId.WIZARD]: 'Wizard',
  [ClassId.SORCERER]: 'Sorcerer',
  [ClassId.NECROMANCER]: 'Necromancer',
  [ClassId.WARLOCK]: 'Warlock',
  [ClassId.CLERIC]: 'Cleric',
  [ClassId.BISHOP]: 'Bishop',
  [ClassId.PROPHET]: 'Prophet',
  [ClassId.ELVEN_FIGHTER]: 'Elven Fighter',
  [ClassId.ELVEN_KNIGHT]: 'Elven Knight',
  [ClassId.TEMPLE_KNIGHT]: 'Temple Knight',
  [ClassId.SWORDSINGER]: 'Swordsinger',
  [ClassId.ELVEN_SCOUT]: 'Elven Scout',
  [ClassId.PLAINS_WALKER]: 'Plains Walker',
  [ClassId.SILVER_RANGER]: 'Silver Ranger',
  [ClassId.ELVEN_MAGE]: 'Elven Mage',
  [ClassId.ELVEN_WIZARD]: 'Elven Wizard',
  [ClassId.SPELLSINGER]: 'Spellsinger',
  [ClassId.ELEMENTAL_SUMMONER]: 'Elemental Summoner',
  [ClassId.ORACLE]: 'Oracle',
  [ClassId.ELDER]: 'Elder',
  [ClassId.DARK_FIGHTER]: 'Dark Fighter',
  [ClassId.PALUS_KNIGHT]: 'Palus Knight',
  [ClassId.SHILLIEN_KNIGHT]: 'Shillien Knight',
  [ClassId.BLADEDANCER]: 'Bladedancer',
  [ClassId.ASSASSIN]: 'Assassin',
  [ClassId.ABYSS_WALKER]: 'Abyss Walker',
  [ClassId.PHANTOM_RANGER]: 'Phantom Ranger',
  [ClassId.DARK_MAGE]: 'Dark Mage',
  [ClassId.DARK_WIZARD]: 'Dark Wizard',
  [ClassId.SPELLHOWLER]: 'Spellhowler',
  [ClassId.PHANTOM_SUMMONER]: 'Phantom Summoner',
  [ClassId.SHILLIEN_ORACLE]: 'Shillien Oracle',
  [ClassId.SHILLIEN_ELDER]: 'Shillien Elder',
  [ClassId.ORC_FIGHTER]: 'Orc Fighter',
  [ClassId.ORC_RAIDER]: 'Orc Raider',
  [ClassId.DESTROYER]: 'Destroyer',
  [ClassId.ORC_MONK]: 'Orc Monk',
  [ClassId.TYRANT]: 'Tyrant',
  [ClassId.ORC_MAGE]: 'Orc Mage',
  [ClassId.ORC_SHAMAN]: 'Orc Shaman',
  [ClassId.OVERLORD]: 'Overlord',
  [ClassId.WARCRYER]: 'Warcryer',
  [ClassId.DWARVEN_FIGHTER]: 'Dwarven Fighter',
  [ClassId.SCAVENGER]: 'Scavenger',
  [ClassId.BOUNTY_HUNTER]: 'Bounty Hunter',
  [ClassId.ARTISAN]: 'Artisan',
  [ClassId.WARSMITH]: 'Warsmith',
  [ClassId.DUMMY_58]: 'Unknown',
  [ClassId.DUMMY_59]: 'Unknown',
  [ClassId.DUMMY_60]: 'Unknown',
  [ClassId.DUMMY_61]: 'Unknown',
  [ClassId.DUMMY_62]: 'Unknown',
  [ClassId.DUMMY_63]: 'Unknown',
  [ClassId.DUMMY_64]: 'Unknown',
  [ClassId.DUMMY_65]: 'Unknown',
  [ClassId.DUMMY_66]: 'Unknown',
  [ClassId.DUMMY_67]: 'Unknown',
  [ClassId.DUMMY_68]: 'Unknown',
  [ClassId.DUMMY_69]: 'Unknown',
  [ClassId.DUMMY_70]: 'Unknown',
  [ClassId.DUMMY_71]: 'Unknown',
  [ClassId.DUMMY_72]: 'Unknown',
  [ClassId.DUMMY_73]: 'Unknown',
  [ClassId.DUMMY_74]: 'Unknown',
  [ClassId.DUMMY_75]: 'Unknown',
  [ClassId.DUMMY_76]: 'Unknown',
  [ClassId.DUMMY_77]: 'Unknown',
  [ClassId.DUMMY_78]: 'Unknown',
  [ClassId.DUMMY_79]: 'Unknown',
  [ClassId.DUMMY_80]: 'Unknown',
  [ClassId.DUMMY_81]: 'Unknown',
  [ClassId.DUMMY_82]: 'Unknown',
  [ClassId.DUMMY_83]: 'Unknown',
  [ClassId.DUMMY_84]: 'Unknown',
  [ClassId.DUMMY_85]: 'Unknown',
  [ClassId.DUMMY_86]: 'Unknown',
  [ClassId.DUMMY_87]: 'Unknown',
  [ClassId.DUELIST]: 'Duelist',
  [ClassId.DREADNOUGHT]: 'Dreadnought',
  [ClassId.PHOENIX_KNIGHT]: 'Phoenix Knight',
  [ClassId.HELL_KNIGHT]: 'Hell Knight',
  [ClassId.SAGITTARIUS]: 'Sagittarius',
  [ClassId.ADVENTURER]: 'Adventurer',
  [ClassId.ARCHMAGE]: 'Archmage',
  [ClassId.SOULTAKER]: 'Soultaker',
  [ClassId.ARCANA_LORD]: 'Arcana Lord',
  [ClassId.CARDINAL]: 'Cardinal',
  [ClassId.HIEROPHANT]: 'Hierophant',
  [ClassId.EVA_TEMPLAR]: 'Eva\'s Templar',
  [ClassId.SWORD_MUSE]: 'Sword Muse',
  [ClassId.WIND_RIDER]: 'Wind Rider',
  [ClassId.MOONLIGHT_SENTINEL]: 'Moonlight Sentinel',
  [ClassId.MYSTIC_MUSE]: 'Mystic Muse',
  [ClassId.ELEMENTAL_MASTER]: 'Elemental Master',
  [ClassId.EVA_SAINT]: 'Eva\'s Saint',
  [ClassId.SHILLIEN_TEMPLAR]: 'Shillien Templar',
  [ClassId.SPECTRAL_DANCER]: 'Spectral Dancer',
  [ClassId.GHOST_HUNTER]: 'Ghost Hunter',
  [ClassId.GHOST_SENTINEL]: 'Ghost Sentinel',
  [ClassId.STORM_SCREAMER]: 'Storm Screamer',
  [ClassId.SPECTRAL_MASTER]: 'Spectral Master',
  [ClassId.SHILLIEN_SAINT]: 'Shillien Saint',
  [ClassId.TITAN]: 'Titan',
  [ClassId.GRAND_KHAVATARI]: 'Grand Khavatari',
  [ClassId.DOMINATOR]: 'Dominator',
  [ClassId.DOOMCRYER]: 'Doomcryer',
  [ClassId.FORTUNE_SEEKER]: 'Fortune Seeker',
  [ClassId.MAESTRO]: 'Maestro',
};

export const RaceIdNames: Record<RaceId, string> = {
  [RaceId.HUMAN]: 'Human',
  [RaceId.ELF]: 'Elf',
  [RaceId.DARK_ELF]: 'Dark Elf',
  [RaceId.ORC]: 'Orc',
  [RaceId.DWARF]: 'Dwarf',
  [RaceId.KAMAEL]: 'Kamael',
};

export const SexNames: Record<Sex, string> = {
  [Sex.MALE]: 'Male',
  [Sex.FEMALE]: 'Female',
};

export const ItemGradeNames: Record<ItemGrade, string> = {
  [ItemGrade.NONE]: 'No Grade',
  [ItemGrade.D]: 'D Grade',
  [ItemGrade.C]: 'C Grade',
  [ItemGrade.B]: 'B Grade',
  [ItemGrade.A]: 'A Grade',
  [ItemGrade.S]: 'S Grade',
};

export const PaperdollSlotNames: Record<PaperdollSlot, string> = {
  [PaperdollSlot.UNDER]: 'Underwear',
  [PaperdollSlot.REAR]: 'Right Earring',
  [PaperdollSlot.LEAR]: 'Left Earring',
  [PaperdollSlot.NECK]: 'Necklace',
  [PaperdollSlot.RFINGER]: 'Right Ring',
  [PaperdollSlot.LFINGER]: 'Left Ring',
  [PaperdollSlot.HEAD]: 'Head',
  [PaperdollSlot.RHAND]: 'Right Hand',
  [PaperdollSlot.LHAND]: 'Left Hand',
  [PaperdollSlot.GLOVES]: 'Gloves',
  [PaperdollSlot.CHEST]: 'Chest',
  [PaperdollSlot.LEGS]: 'Legs',
  [PaperdollSlot.FEET]: 'Feet',
  [PaperdollSlot.BACK]: 'Back',
  [PaperdollSlot.HAIR]: 'Hair',
  [PaperdollSlot.HAIR2]: 'Hair 2',
};

export const ChatChannelNames: Record<ChatChannel, string> = {
  [ChatChannel.ALL]: 'All',
  [ChatChannel.SHOUT]: 'Shout',
  [ChatChannel.TELL]: 'Tell',
  [ChatChannel.PARTY]: 'Party',
  [ChatChannel.CLAN]: 'Clan',
  [ChatChannel.GM]: 'GM',
  [ChatChannel.PETITION_PLAYER]: 'Petition Player',
  [ChatChannel.PETITION_GM]: 'Petition GM',
  [ChatChannel.TRADE]: 'Trade',
  [ChatChannel.ALLIANCE]: 'Alliance',
  [ChatChannel.ANNOUNCEMENT]: 'Announcement',
  [ChatChannel.BOAT]: 'Boat',
  [ChatChannel.L2FRIEND]: 'L2Friend',
  [ChatChannel.MSNCHAT]: 'MSN Chat',
  [ChatChannel.PARTYMATCH_ROOM]: 'Party Match Room',
  [ChatChannel.PARTYROOM_COMMANDER]: 'Party Room Commander',
  [ChatChannel.PARTYROOM_ALL]: 'Party Room All',
};

// ============ Helper Functions ============

export function getClassName(classId: number): string {
  return ClassIdNames[classId as ClassId] || `Unknown Class (${classId})`;
}

export function getRaceName(raceId: number): string {
  return RaceIdNames[raceId as RaceId] || `Unknown Race (${raceId})`;
}

export function getSexName(sex: number): string {
  return SexNames[sex as Sex] || `Unknown (${sex})`;
}

export function getItemGradeName(grade: number): string {
  return ItemGradeNames[grade as ItemGrade] || `Grade ${grade}`;
}

export function getPaperdollSlotName(slot: number): string {
  return PaperdollSlotNames[slot as PaperdollSlot] || `Slot ${slot}`;
}

export function getChatChannelName(channel: number): string {
  return ChatChannelNames[channel as ChatChannel] || `Channel ${channel}`;
}

// ============ Utility Functions ============

export function isMageClass(classId: number): boolean {
  const mageClasses = [
    ClassId.MAGE, ClassId.WIZARD, ClassId.SORCERER, ClassId.NECROMANCER,
    ClassId.WARLOCK, ClassId.CLERIC, ClassId.BISHOP, ClassId.PROPHET,
    ClassId.ELVEN_MAGE, ClassId.ELVEN_WIZARD, ClassId.SPELLSINGER,
    ClassId.ELEMENTAL_SUMMONER, ClassId.ORACLE, ClassId.ELDER,
    ClassId.DARK_MAGE, ClassId.DARK_WIZARD, ClassId.SPELLHOWLER,
    ClassId.PHANTOM_SUMMONER, ClassId.SHILLIEN_ORACLE, ClassId.SHILLIEN_ELDER,
    ClassId.ORC_MAGE, ClassId.ORC_SHAMAN, ClassId.OVERLORD, ClassId.WARCRYER,
    ClassId.ARCHMAGE, ClassId.SOULTAKER, ClassId.ARCANA_LORD,
    ClassId.CARDINAL, ClassId.HIEROPHANT, ClassId.MYSTIC_MUSE,
    ClassId.ELEMENTAL_MASTER, ClassId.EVA_SAINT, ClassId.STORM_SCREAMER,
    ClassId.SPECTRAL_MASTER, ClassId.SHILLIEN_SAINT, ClassId.DOMINATOR,
    ClassId.DOOMCRYER,
  ];
  return mageClasses.includes(classId as ClassId);
}

export function isFighterClass(classId: number): boolean {
  return !isMageClass(classId);
}
