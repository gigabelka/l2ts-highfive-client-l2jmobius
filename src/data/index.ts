// src/data/index.ts
// Экспорт всех данных и типов L2J Mobius

// Types
export * from './types';

// Constants & Enums
export {
  ClassId,
  RaceId,
  Sex,
  PaperdollSlot,
  ItemGrade,
  ItemType,
  BodyPart,
  GameOpCode,
  ChatChannel,
  NpcType,
  StatusUpdateType,
  SkillType,
  EnchantEffectType,
  // Name mappings
  ClassIdNames,
  RaceIdNames,
  SexNames,
  ItemGradeNames,
  PaperdollSlotNames,
  ChatChannelNames,
  // Helper functions
  getClassName,
  getRaceName,
  getSexName,
  getItemGradeName,
  getPaperdollSlotName,
  getChatChannelName,
  isMageClass,
  isFighterClass,
} from './constants';

// Data loader & utilities
export * from './loader';

// Database singletons
export { SkillDatabase, SkillDatabaseInstance } from './SkillDatabase';
export { NpcDatabase, NpcDatabaseInstance } from './NpcDatabase';
export { ItemDatabase, ItemDatabaseInstance } from './ItemDatabase';

// Raw data exports (for direct access)
export {
  armorSets,
  items,
  npcs,
  skills,
  skillTrees,
  classTemplates,
  pets,
  fishing,
  hennas,
  augmentation,
} from './loader';
