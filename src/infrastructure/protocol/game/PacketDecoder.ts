/**
 * @fileoverview PacketDecoder - декодер пакетов L2 Interlude
 * Преобразует WebSocket сообщения с raw_packet в читаемые события
 * @module infrastructure/protocol/game
 */

/** Категории пакетов */
type PacketCategory = 'AUTH' | 'MOVEMENT' | 'COMBAT' | 'CHAT' | 'STATUS' | 'SPAWN' | 'INVENTORY' | 'SYSTEM';

/** Определение пакета */
interface PacketDefinition {
    name: string;
    category: PacketCategory;
    fields: string[];
}

/** Карта опкодов → определения пакетов (L2J Mobius CT0 Interlude server→client) */
const OPCODE_MAP: Map<number, PacketDefinition> = new Map([
    // === Авторизация / Лобби ===
    [0x00, { name: 'CryptInit', category: 'AUTH', fields: ['sessionId'] }],
    [0x13, { name: 'CharSelectInfo', category: 'AUTH', fields: ['chars'] }],
    [0x14, { name: 'LoginFail', category: 'AUTH', fields: ['reason'] }],
    [0x15, { name: 'CharSelected', category: 'AUTH', fields: ['name', 'charId', 'title', 'x', 'y', 'z', 'class'] }],
    [0x7E, { name: 'LogoutOk', category: 'AUTH', fields: [] }],
    [0xE9, { name: 'KeyPacket', category: 'AUTH', fields: ['key'] }],

    // === Движение ===
    [0x01, { name: 'MoveToLocation', category: 'MOVEMENT', fields: ['objectId', 'targetX', 'targetY', 'targetZ', 'originX', 'originY', 'originZ'] }],
    [0x09, { name: 'StopMove', category: 'MOVEMENT', fields: ['objectId', 'x', 'y', 'z', 'heading'] }],
    [0x27, { name: 'TeleportToLocation', category: 'MOVEMENT', fields: ['objectId', 'x', 'y', 'z'] }],
    [0x28, { name: 'ChangeMoveType', category: 'MOVEMENT', fields: ['objectId', 'isRunning'] }],
    [0x2E, { name: 'MoveToLocation', category: 'MOVEMENT', fields: ['objectId', 'targetX', 'targetY', 'targetZ', 'originX', 'originY', 'originZ'] }],
    [0x2F, { name: 'ChangeWaitType', category: 'MOVEMENT', fields: ['objectId', 'waitType'] }],
    [0x38, { name: 'TeleportToLocation', category: 'MOVEMENT', fields: ['objectId', 'x', 'y', 'z'] }],
    [0x3E, { name: 'ChangeMoveType', category: 'MOVEMENT', fields: ['objectId', 'isRunning'] }],
    [0x3F, { name: 'ValidateLocation', category: 'MOVEMENT', fields: ['objectId', 'x', 'y', 'z', 'heading'] }],
    [0x59, { name: 'StopMove', category: 'MOVEMENT', fields: ['objectId', 'x', 'y', 'z', 'heading'] }],
    [0x60, { name: 'MoveToPawn', category: 'MOVEMENT', fields: ['objectId', 'targetId', 'distance', 'x', 'y', 'z'] }],
    [0x61, { name: 'ValidateLocation', category: 'MOVEMENT', fields: ['objectId', 'x', 'y', 'z', 'heading'] }],

    // === Спавн / Мир ===
    [0x03, { name: 'CharInfo', category: 'SPAWN', fields: ['objectId', 'name', 'race', 'sex', 'classId', 'x', 'y', 'z'] }],
    [0x04, { name: 'UserInfo', category: 'STATUS', fields: ['name', 'race', 'sex', 'classId', 'level', 'exp', 'currentHp', 'currentMp', 'sp', 'x', 'y', 'z'] }],
    [0x08, { name: 'DeleteObject', category: 'SPAWN', fields: ['objectId'] }],
    [0x0B, { name: 'SpawnItem', category: 'SPAWN', fields: ['objectId', 'itemId', 'x', 'y', 'z', 'stackable', 'count'] }],
    [0x0C, { name: 'DropItem', category: 'SPAWN', fields: ['objectId', 'itemId', 'x', 'y', 'z', 'count'] }],
    [0x16, { name: 'NpcInfo', category: 'SPAWN', fields: ['objectId', 'npcId', 'attackable', 'x', 'y', 'z', 'currentHp', 'maxHp', 'title'] }],

    // === Боевые ===
    [0x05, { name: 'Attack', category: 'COMBAT', fields: ['attackerId', 'targetId', 'hits'] }],
    [0x06, { name: 'Die', category: 'COMBAT', fields: ['objectId'] }],
    [0x07, { name: 'Revive', category: 'STATUS', fields: ['objectId'] }],
    [0x1C, { name: 'TargetSelected', category: 'COMBAT', fields: ['objectId', 'targetId', 'x', 'y', 'z'] }],
    [0x1D, { name: 'TargetUnselected', category: 'COMBAT', fields: ['objectId', 'x', 'y', 'z'] }],
    [0x1E, { name: 'AutoAttackStart', category: 'COMBAT', fields: ['targetObjectId'] }],
    [0x1F, { name: 'AutoAttackStop', category: 'COMBAT', fields: ['targetObjectId'] }],
    [0x29, { name: 'TargetSelected', category: 'COMBAT', fields: ['objectId', 'targetId', 'x', 'y', 'z'] }],
    [0x47, { name: 'StopMove', category: 'MOVEMENT', fields: ['objectId'] }],
    [0x48, { name: 'MagicSkillLaunched', category: 'COMBAT', fields: ['casterObjectId', 'skillId', 'skillLevel'] }],
    [0x54, { name: 'MagicSkillLaunched', category: 'COMBAT', fields: ['casterObjectId', 'skillId', 'skillLevel'] }],
    [0x76, { name: 'MagicSkillUse', category: 'COMBAT', fields: ['attackerId', 'targetId', 'skillId', 'skillLevel', 'hitTime'] }],
    [0xA1, { name: 'MyTargetSelected', category: 'COMBAT', fields: ['objectId', 'color'] }],
    [0xA6, { name: 'TargetUnselected', category: 'COMBAT', fields: ['objectId', 'x', 'y', 'z'] }],

    // === Статус ===
    [0x0E, { name: 'StatusUpdate', category: 'STATUS', fields: ['objectId', 'attributes'] }],
    [0x39, { name: 'AbnormalStatusUpdate', category: 'STATUS', fields: ['effects'] }],
    [0x64, { name: 'SetupGauge', category: 'STATUS', fields: ['objectId', 'color', 'currentTime', 'maxTime'] }],
    [0x6D, { name: 'SetupGauge', category: 'STATUS', fields: ['objectId', 'color', 'currentTime', 'maxTime'] }],

    // === Чат ===
    [0x02, { name: 'NpcSay', category: 'CHAT', fields: ['objectId', 'messageType', 'npcId', 'message'] }],
    [0x4A, { name: 'CreatureSay', category: 'CHAT', fields: ['objectId', 'messageType', 'senderName', 'message'] }],

    // === Инвентарь ===
    [0x0D, { name: 'GetItem', category: 'INVENTORY', fields: ['objectId', 'itemObjectId', 'x', 'y', 'z'] }],
    [0x19, { name: 'InventoryUpdate', category: 'INVENTORY', fields: ['changes'] }],
    [0x1B, { name: 'ItemList', category: 'INVENTORY', fields: ['items'] }],

    // === Скиллы ===
    [0x58, { name: 'SkillList', category: 'SYSTEM', fields: ['skills'] }],

    // === Социальные ===
    [0x20, { name: 'SocialAction', category: 'SYSTEM', fields: ['objectId', 'actionId'] }],
    [0x2D, { name: 'SocialAction', category: 'SYSTEM', fields: ['objectId', 'actionId'] }],

    // === Системные ===
    [0x0F, { name: 'NpcHtmlMessage', category: 'SYSTEM', fields: ['npcObjectId', 'html', 'itemId'] }],
    [0x25, { name: 'ActionFailed', category: 'SYSTEM', fields: [] }],
    [0x62, { name: 'SystemMessage', category: 'SYSTEM', fields: ['messageId', 'params'] }],
    [0x65, { name: 'ShortCutInit', category: 'SYSTEM', fields: ['shortcuts'] }],
    [0x56, { name: 'QuestList', category: 'SYSTEM', fields: ['quests'] }],
    [0x80, { name: 'QuestList', category: 'SYSTEM', fields: ['quests'] }],
    [0xD3, { name: 'NetPingRequest', category: 'SYSTEM', fields: [] }],
    [0xFE, { name: 'ExPacket', category: 'SYSTEM', fields: ['subOpcode'] }],

    // === Группа / Клан ===
    [0x2A, { name: 'AskJoinParty', category: 'SYSTEM', fields: [] }],
    [0x40, { name: 'PartySmallWindowAll', category: 'SYSTEM', fields: [] }],
    [0x41, { name: 'PartySmallWindowAdd', category: 'SYSTEM', fields: [] }],
    [0x42, { name: 'PartySmallWindowDeleteAll', category: 'SYSTEM', fields: [] }],
    [0x43, { name: 'PartySmallWindowDelete', category: 'SYSTEM', fields: [] }],
    [0x44, { name: 'PartySmallWindowUpdate', category: 'SYSTEM', fields: [] }],
    [0xA8, { name: 'PartyMemberPosition', category: 'SYSTEM', fields: [] }],

    // === Торговля ===
    [0x10, { name: 'SellList', category: 'SYSTEM', fields: [] }],
    [0x11, { name: 'BuyList', category: 'SYSTEM', fields: [] }],
    [0x7B, { name: 'MultiSellList', category: 'SYSTEM', fields: [] }],

    // === Пет / Саммон ===
    [0x3A, { name: 'PetInfo', category: 'SPAWN', fields: [] }],
    [0x3C, { name: 'PetStatusUpdate', category: 'STATUS', fields: [] }],

    // === Прочие ===
    [0x0A, { name: 'SunRise', category: 'SYSTEM', fields: [] }],
    [0x18, { name: 'StaticObject', category: 'SPAWN', fields: [] }],
    [0x1A, { name: 'TitleUpdate', category: 'SYSTEM', fields: [] }],
    [0x30, { name: 'MagicSkillCanceld', category: 'COMBAT', fields: [] }],
    [0x31, { name: 'EquipUpdate', category: 'INVENTORY', fields: [] }],
    [0x32, { name: 'EtcStatusUpdate', category: 'STATUS', fields: [] }],
    [0x55, { name: 'MagicEffectIcons', category: 'STATUS', fields: [] }],
    [0x57, { name: 'EnchantResult', category: 'SYSTEM', fields: [] }],
    [0x79, { name: 'Earthquake', category: 'SYSTEM', fields: [] }],
    [0x7A, { name: 'FlyToLocation', category: 'MOVEMENT', fields: ['objectId', 'x', 'y', 'z'] }],
    [0x85, { name: 'ConfirmDlg', category: 'SYSTEM', fields: ['messageId'] }],
    [0xA3, { name: 'ReviveRequest', category: 'SYSTEM', fields: [] }],
    [0xE4, { name: 'RelationChanged', category: 'SYSTEM', fields: [] }],
]);

/** Маппинг категорий → префикс event_type */
const CATEGORY_TYPE_MAP: Record<PacketCategory, string> = {
    AUTH: 'auth',
    MOVEMENT: 'game.move',
    COMBAT: 'game.combat',
    CHAT: 'game.chat',
    STATUS: 'game.status',
    SPAWN: 'game.spawn',
    INVENTORY: 'game.inventory',
    SYSTEM: 'system',
};

/** Входное сообщение WebSocket */
export interface RawPacketMessage {
    type: string;
    channel: string;
    payload: {
        opcode: number;
        opcodeHex: string;
        length: number;
        state: string;
        [key: string]: unknown;
    };
    timestamp: string;
}

/** Выходное событие */
export interface DecodedPacketEvent {
    type: string;
    packet: {
        name: string;
        opcode: number;
        opcodeHex: string;
        category: PacketCategory;
        length: number;
        state: string;
        data: Record<string, unknown>;
    };
    summary: string;
    world: {
        zone: string | null;
        region: string | null;
        nearbyObjects: number | null;
    };
    timestamp: string;
}

/**
 * Вспомогательная функция для получения значения из extraData
 */
function getValue(extraData: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
        if (key in extraData) {
            return extraData[key];
        }
    }
    return undefined;
}

/**
 * Создает пустой объект data с полями пакета (все null)
 */
function createEmptyData(fields: string[]): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    for (const field of fields) {
        data[field] = null;
    }
    return data;
}

/**
 * Генерирует summary на русском языке
 */
function generateSummary(
    packetDef: PacketDefinition,
    payload: RawPacketMessage['payload']
): string {
    const { name } = packetDef;
    const extraData = payload;

    switch (name) {
        case 'MoveToLocation': {
            const toX = getValue(extraData, ['toX', 'to_x']) ?? '?';
            const toY = getValue(extraData, ['toY', 'to_y']) ?? '?';
            const toZ = getValue(extraData, ['toZ', 'to_z']) ?? '?';
            return `Объект начал движение → (${toX}, ${toY}, ${toZ})`;
        }

        case 'Attack': {
            const damage = getValue(extraData, ['damage']) ?? '?';
            const critical = extraData['critical'];
            return `Атака по цели — урон ${damage}${critical ? ' [Крит!]' : ''}`;
        }

        case 'Die': {
            const sweepable = extraData['sweepable'];
            return `Объект погиб${sweepable ? ' [sweep возможен]' : ''}`;
        }

        case 'Say2': {
            const channel = getValue(extraData, ['channelName', 'channel', 'type']) ?? '?';
            const speaker = extraData['name'] ?? '?';
            const text = extraData['text'] ?? '...';
            return `[${channel}] ${speaker}: '${text}'`;
        }

        case 'TeleportToLocation': {
            const toX = getValue(extraData, ['toX', 'to_x']) ?? '?';
            const toY = getValue(extraData, ['toY', 'to_y']) ?? '?';
            const toZ = getValue(extraData, ['toZ', 'to_z']) ?? '?';
            return `Телепорт → (${toX}, ${toY}, ${toZ})`;
        }

        case 'StatusUpdate': {
            return 'HP/MP/CP обновлён у объекта';
        }

        case 'NetPingRequest': {
            return 'Ping от сервера — нужен Pong';
        }

        case 'ActionFailed': {
            return 'Действие отклонено сервером';
        }

        case 'UserInfo': {
            const lvl = extraData['level'] ?? '?';
            const hp = extraData['hp'] ?? '?';
            return `UserInfo: уровень ${lvl}, HP ${hp}`;
        }

        case 'NpcInfo': {
            const npcId = getValue(extraData, ['npcId', 'npc_id']) ?? '?';
            const title = extraData['title'] ?? '';
            return `NPC ${npcId} появился${title ? ` (${title})` : ''}`;
        }

        case 'CharInfo': {
            const charName = extraData['name'] ?? '?';
            return `Игрок ${charName} появился в зоне видимости`;
        }

        case 'ItemList': {
            const items = extraData['items'];
            const count = items && Array.isArray(items) ? items.length : (getValue(extraData, ['itemCount', 'count']) ?? '?');
            return `Получен список инвентаря (${count} предметов)`;
        }

        case 'InventoryUpdate': {
            return 'Инвентарь обновлён';
        }

        case 'SpawnItem': {
            const itemId = getValue(extraData, ['itemId', 'item_id']) ?? '?';
            return `Предмет ${itemId} появился в мире`;
        }

        case 'DeleteObject': {
            const objId = getValue(extraData, ['objectId', 'object_id']) ?? '?';
            return `Объект ${objId} удалён из мира`;
        }

        case 'TargetSelected': {
            const targetId = getValue(extraData, ['targetId', 'target_id']) ?? '?';
            return `Цель выбрана: ${targetId}`;
        }

        case 'TargetUnselected': {
            return 'Цель сброшена';
        }

        case 'MagicSkillUse': {
            const skillId = getValue(extraData, ['skillId', 'skill_id']) ?? '?';
            const castTime = getValue(extraData, ['castTime', 'cast_time']) ?? '?';
            return `Используется скилл ${skillId} (${castTime}мс)`;
        }

        case 'MagicSkillLaunched': {
            const skillId = getValue(extraData, ['skillId', 'skill_id']) ?? '?';
            return `Скилл ${skillId} запущен`;
        }

        case 'SocialAction': {
            const actionId = getValue(extraData, ['actionId', 'action_id']) ?? '?';
            return `Социальное действие: ${actionId}`;
        }

        case 'StopMove': {
            return 'Движение остановлено';
        }

        case 'ValidateLocation': {
            const x = extraData['x'] ?? '?';
            const y = extraData['y'] ?? '?';
            return `Позиция валидирована: (${x}, ${y})`;
        }

        case 'ChangeMoveType': {
            const running = extraData['isRunning'] ?? extraData['running'];
            return running ? 'Начат бег' : 'Начата ходьба';
        }

        case 'ChangeWaitType': {
            const moveType = (getValue(extraData, ['moveType', 'move_type']) as number) ?? 0;
            const types = ['стоит', 'сидит', 'feign death'];
            return `Состояние: ${types[moveType] ?? 'неизвестно'}`;
        }

        case 'CharList':
        case 'CharSelectInfo': {
            const chars = extraData['chars'];
            const charCount = chars && Array.isArray(chars) ? chars.length : (extraData['charCount'] ?? '?');
            return `Список персонажей (${charCount})`;
        }

        case 'CharSelected': {
            const charName = extraData['name'] ?? '?';
            return `Выбран персонаж: ${charName}`;
        }

        case 'SystemMessage': {
            const msgId = getValue(extraData, ['messageId', 'message_id']) ?? '?';
            return `Системное сообщение [ID: ${msgId}]`;
        }

        case 'NpcHtmlMessage': {
            return 'HTML сообщение от NPC';
        }

        case 'QuestList': {
            const quests = extraData['quests'];
            const questCount = quests && Array.isArray(quests) ? quests.length : '?';
            return `Список квестов (${questCount})`;
        }

        case 'ShortCutInit': {
            const shortcuts = extraData['shortcuts'];
            const shortcutCount = shortcuts && Array.isArray(shortcuts) ? shortcuts.length : '?';
            return `Инициализация панели (${shortcutCount} слотов)`;
        }

        case 'SetupGauge': {
            const color = extraData['color'] ?? '?';
            const time = extraData['time'] ?? '?';
            return `Прогрессбар: цвет=${color}, время=${time}мс`;
        }

        case 'Revive': {
            return 'Объект воскрешён';
        }

        case 'GetItem': {
            const itemId = getValue(extraData, ['itemId', 'item_id', 'itemObjectId']) ?? '?';
            return `Предмет ${itemId} поднят`;
        }

        case 'AutoAttackStart': {
            return 'Начало автоатаки';
        }

        case 'AutoAttackStop': {
            return 'Окончание автоатаки';
        }

        case 'MoveToPawn': {
            const targetId = getValue(extraData, ['targetId', 'target_id']) ?? '?';
            return `Следование за целью ${targetId}`;
        }

        case 'NpcSay': {
            const speaker = extraData['npcId'] ?? extraData['objectId'] ?? '?';
            const msg = extraData['message'] ?? '...';
            return `NPC ${speaker}: '${msg}'`;
        }

        case 'MagicSkillCanceld': {
            return 'Каст скилла отменён';
        }

        case 'MyTargetSelected': {
            const objId = getValue(extraData, ['objectId', 'object_id']) ?? '?';
            return `Цель выбрана: ${objId}`;
        }

        case 'AbnormalStatusUpdate': {
            return 'Обновление баффов/дебаффов';
        }

        case 'EquipUpdate': {
            return 'Обновление экипировки';
        }

        case 'EtcStatusUpdate': {
            return 'Обновление веса/штрафов';
        }

        case 'MagicEffectIcons': {
            return 'Обновление иконок эффектов';
        }

        case 'PartySmallWindowAll':
        case 'PartySmallWindowAdd':
        case 'PartySmallWindowUpdate': {
            return 'Обновление информации группы';
        }

        case 'PartySmallWindowDelete':
        case 'PartySmallWindowDeleteAll': {
            return 'Изменение состава группы';
        }

        case 'PartyMemberPosition': {
            return 'Обновление позиций группы';
        }

        case 'ConfirmDlg': {
            const msgId = getValue(extraData, ['messageId', 'message_id']) ?? '?';
            return `Диалог подтверждения [ID: ${msgId}]`;
        }

        case 'ReviveRequest': {
            return 'Запрос воскрешения';
        }

        case 'KeyPacket': {
            return 'Ключ шифрования от сервера';
        }

        case 'RelationChanged': {
            return 'Изменение отношений';
        }

        case 'FlyToLocation': {
            return 'Полёт к позиции (knockback)';
        }

        case 'Earthquake': {
            return 'Эффект землетрясения';
        }

        case 'SunRise': {
            return 'Восход солнца';
        }

        case 'StaticObject': {
            return 'Статический объект (дверь/колонна)';
        }

        case 'TitleUpdate': {
            return 'Обновление титула';
        }

        case 'PetInfo': {
            return 'Информация о пете';
        }

        case 'PetStatusUpdate': {
            return 'Обновление статуса пета';
        }

        case 'SellList':
        case 'BuyList':
        case 'MultiSellList': {
            return `Список товаров (${name})`;
        }

        case 'EnchantResult': {
            return 'Результат заточки';
        }

        case 'AskJoinParty': {
            return 'Приглашение в группу';
        }

        case 'Logout':
        case 'LogoutOk':
        case 'LogoutOK': {
            return 'Выход из игры';
        }

        case 'Init':
        case 'CryptInit': {
            const sessionId = getValue(extraData, ['sessionId', 'session_id']) ?? '?';
            return `Инициализация сессии ${sessionId}`;
        }

        case 'ExPacket': {
            const subOpcode = getValue(extraData, ['subOpcode', 'sub_opcode']) ?? '?';
            return `Расширенный пакет (sub: 0x${Number(subOpcode).toString(16).toUpperCase()})`;
        }

        default:
            return `Пакет ${name}`;
    }
}

/**
 * Декодирует raw пакет в читаемое событие
 * @param message WebSocket сообщение с raw_packet
 * @returns Декодированное событие
 */
export function decodePacket(message: RawPacketMessage): DecodedPacketEvent {
    const { opcode, opcodeHex, length, state, ...extraFields } = message.payload;
    const timestamp = message.timestamp;

    // Ищем определение пакета
    const packetDef = OPCODE_MAP.get(opcode);

    if (!packetDef) {
        // Неизвестный пакет
        return {
            type: 'system.unknown',
            packet: {
                name: 'Unknown',
                opcode,
                opcodeHex,
                category: 'SYSTEM',
                length,
                state,
                data: { raw: extraFields },
            },
            summary: `Неизвестный пакет 0x${opcode.toString(16).toUpperCase().padStart(2, '0')}`,
            world: {
                zone: null,
                region: null,
                nearbyObjects: null,
            },
            timestamp,
        };
    }

    // Создаем data с полями пакета
    const data = createEmptyData(packetDef.fields);

    // Добавляем дополнительные поля из payload если они есть
    for (const [key, value] of Object.entries(extraFields)) {
        if (value !== undefined && value !== null) {
            data[key] = value;
        }
    }

    // Формируем type
    const typePrefix = CATEGORY_TYPE_MAP[packetDef.category];
    const type = `${typePrefix}.${packetDef.name.toLowerCase()}`;

    // Генерируем summary
    const summary = generateSummary(packetDef, message.payload);

    return {
        type,
        packet: {
            name: packetDef.name,
            opcode,
            opcodeHex,
            category: packetDef.category,
            length,
            state,
            data,
        },
        summary,
        world: {
            zone: null,
            region: null,
            nearbyObjects: null,
        },
        timestamp,
    };
}

/**
 * Получить информацию о пакете по опкоду
 * @param opcode Номер опкода
 * @returns Определение пакета или undefined
 */
export function getPacketDefinition(opcode: number): PacketDefinition | undefined {
    return OPCODE_MAP.get(opcode);
}

/**
 * Получить список всех поддерживаемых опкодов
 * @returns Массив опкодов
 */
export function getSupportedOpcodes(): number[] {
    return Array.from(OPCODE_MAP.keys()).sort((a, b) => a - b);
}

/**
 * Проверить, поддерживается ли опкод
 * @param opcode Номер опкода
 * @returns true если опкод известен
 */
export function isOpcodeKnown(opcode: number): boolean {
    return OPCODE_MAP.has(opcode);
}
