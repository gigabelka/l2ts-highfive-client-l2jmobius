/**
 * src/data/slotMasks.ts
 * Битовые маски слотов экипировки для Lineage 2 Interlude
 * Согласно протоколу L2J_Mobius CT_0_Interlude (Protocol 746)
 */

export const SLOT_MASKS = {
    HEAD: 0x0002,
    NECK: 0x0010,
    REAR_LEAR: 0x0020, // Серьги
    RHAND: 0x0040,     // Оружие (правая рука)
    LHAND: 0x0080,     // Щит / Двуручное оружие (левая рука)
    GLOVES: 0x0100,    // Перчатки
    CHEST: 0x0200,     // Верхняя броня
    LEGS: 0x0400,      // Штаны
    FEET: 0x0800,      // Ботинки
    BACK: 0x1000,      // Плащ/накидка
} as const;

/**
 * Тип слота экипировки - union type всех возможных ключей
 */
export type EquipmentSlot = keyof typeof SLOT_MASKS;

/**
 * Массив всех слотов для итерации
 */
export const EQUIPMENT_SLOTS: EquipmentSlot[] = [
    'HEAD',
    'NECK',
    'REAR_LEAR',
    'RHAND',
    'LHAND',
    'GLOVES',
    'CHEST',
    'LEGS',
    'FEET',
    'BACK',
];

/**
 * Получает ключ слота экипировки по битовой маске
 * @param slotMask - битовая маска слота из пакета
 * @returns ключ слота или null если маска не распознана
 */
export function getSlotKeyByMask(slotMask: number): EquipmentSlot | null {
    for (const [key, mask] of Object.entries(SLOT_MASKS)) {
        if (mask === slotMask) {
            return key as EquipmentSlot;
        }
    }
    return null;
}

/**
 * Проверяет, является ли маска валидным слотом экипировки
 * @param slotMask - битовая маска для проверки
 */
export function isValidEquipmentSlot(slotMask: number): boolean {
    return Object.values(SLOT_MASKS).some((mask) => mask === slotMask);
}
