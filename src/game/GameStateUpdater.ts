/**
 * @fileoverview GameStateUpdater - мост между пакетами и GameState
 * @module game/GameStateUpdater
 *
 * Принимает распарсенные серверные пакеты и обновляет GameState.
 * Эмитит WebSocket события через state.update()
 */

import { GameState } from './GameState';
import {
    CharacterMe,
    Player,
    Npc,
    DroppedItem,
    InventoryItem,
    Skill,
    ChatMessage,
    ActiveEffect,
    TargetInfo,
    TargetType,
    ChatMessageType,
} from './entities/types';
import { getClassName, getNpcName, getItemName } from './dictionaries';

// Опкоды пакетов Interlude (Protocol 746)
const Opcodes = {
    MOVE_TO_LOCATION: 0x2e,        // Используем 0x2E как в существующем MoveToLocationPacket
    SPAWN_ITEM: 0x0b,
    DROP_ITEM: 0x0c,
    STATUS_UPDATE: 0x0e,
    USER_INFO: 0x04,
    CHAR_INFO: 0x03,
    NPC_INFO: 0x16,
    ITEM_LIST: 0x1b,
    INVENTORY_UPDATE: 0x19,
    SKILL_LIST: 0x58,
    ATTACK: 0x05,
    // Пакеты без существующих DTO - используем предполагаемую структуру
    DELETE_OBJECT: 0x08,
    DIE: 0x06,
    REVIVE: 0x07,
    TELEPORT_TO_LOCATION: 0x27,
    CHANGE_WAIT_TYPE: 0x2f,
    ABNORMAL_STATUS_UPDATE: 0x39,
    CREATURE_SAY: 0x4a,
    MAGIC_SKILL_USE: 0x76,
    MY_TARGET_SELECTED: 0xa1,
    TARGET_UNSELECTED: 0xa6,
    STOP_MOVE: 0x59,
} as const;

// Интерфейс для Attack пакета
interface AttackData {
    attackerId: number;
    targetId: number;
    hits: Array<{
        targetId: number;
        damage: number;
        flags: number;
    }>;
}

// Тип сущности для разрешения
enum EntityType {
    ME = 'me',
    PLAYER = 'player',
    NPC = 'npc',
    ITEM = 'item',
    UNKNOWN = 'unknown',
}

/**
 * Интерфейсы для пакетов без существующих DTO
 * Основаны на формате l2js-client и L2J_Mobius
 */

// 0x08 DeleteObject
interface DeleteObjectData {
    objectId: number;
}

// 0x06 Die
interface DieData {
    objectId: number;
}

// 0x07 Revive
interface ReviveData {
    objectId: number;
}

// 0x27 TeleportToLocation
interface TeleportToLocationData {
    objectId: number;
    x: number;
    y: number;
    z: number;
}

// 0x2F ChangeWaitType
interface ChangeWaitTypeData {
    objectId: number;
    waitType: number; // 0 = standing, 1 = sitting
}

// 0x39 AbnormalStatusUpdate (баффы/дебаффы)
interface AbnormalEffectData {
    skillId: number;
    level: number;
    remainingSeconds: number;
}

interface AbnormalStatusUpdateData {
    effects: AbnormalEffectData[];
}

// 0x4A CreatureSay (чат)
interface CreatureSayData {
    objectId: number;
    messageType: number;
    senderName: string;
    message: string;
}

// 0x76 MagicSkillUse
interface MagicSkillUseData {
    attackerId: number;
    targetId: number;
    skillId: number;
    skillLevel: number;
    hitTime: number;
    reuseDelay: number;
    x: number;
    y: number;
    z: number;
    targetX: number;
    targetY: number;
    targetZ: number;
}

// 0xA1 MyTargetSelected
interface MyTargetSelectedData {
    objectId: number;
    color: number; // цовое обозначение агрессии
}

// 0xA6 TargetUnselected
interface TargetUnselectedData {
    objectId: number;
    x: number;
    y: number;
    z: number;
}

// 0x59 StopMove
interface StopMoveData {
    objectId: number;
    x: number;
    y: number;
    z: number;
    heading: number;
}

/**
 * GameStateUpdater - класс для обновления состояния игры из пакетов
 */
export class GameStateUpdater {
    constructor(private readonly state: GameState) {}

    /**
     * Главный метод обработки пакета
     * @param opcode - опкод пакета
     * @param data - данные пакета (распарсенные DTO)
     */
    public handlePacket(opcode: number, data: unknown): void {
        switch (opcode) {
            case Opcodes.USER_INFO:
                this.handleUserInfo(data);
                break;
            case Opcodes.CHAR_INFO:
                this.handleCharInfo(data);
                break;
            case Opcodes.NPC_INFO:
                this.handleNpcInfo(data);
                break;
            case Opcodes.MOVE_TO_LOCATION:
                this.handleMoveToLocation(data);
                break;
            case Opcodes.DELETE_OBJECT:
                this.handleDeleteObject(data as DeleteObjectData);
                break;
            case Opcodes.STATUS_UPDATE:
                this.handleStatusUpdate(data);
                break;
            case Opcodes.SPAWN_ITEM:
                this.handleSpawnItem(data);
                break;
            case Opcodes.DROP_ITEM:
                this.handleDropItem(data);
                break;
            case Opcodes.ITEM_LIST:
                this.handleItemList(data);
                break;
            case Opcodes.INVENTORY_UPDATE:
                this.handleInventoryUpdate(data);
                break;
            case Opcodes.DIE:
                this.handleDie(data as DieData);
                break;
            case Opcodes.REVIVE:
                this.handleRevive(data as ReviveData);
                break;
            case Opcodes.TELEPORT_TO_LOCATION:
                this.handleTeleportToLocation(data as TeleportToLocationData);
                break;
            case Opcodes.CHANGE_WAIT_TYPE:
                this.handleChangeWaitType(data as ChangeWaitTypeData);
                break;
            case Opcodes.ABNORMAL_STATUS_UPDATE:
                this.handleAbnormalStatusUpdate(data as AbnormalStatusUpdateData);
                break;
            case Opcodes.CREATURE_SAY:
                this.handleCreatureSay(data as CreatureSayData);
                break;
            case Opcodes.SKILL_LIST:
                this.handleSkillList(data);
                break;
            case Opcodes.MAGIC_SKILL_USE:
                this.handleMagicSkillUse(data as MagicSkillUseData);
                break;
            case Opcodes.MY_TARGET_SELECTED:
                this.handleMyTargetSelected(data as MyTargetSelectedData);
                break;
            case Opcodes.TARGET_UNSELECTED:
                this.handleTargetUnselected(data as TargetUnselectedData);
                break;
            case Opcodes.STOP_MOVE:
                this.handleStopMove(data as StopMoveData);
                break;
            case Opcodes.ATTACK:
                this.handleAttack(data as AttackData);
                break;
            default:
                // Неизвестный пакет - игнорируем
                break;
        }
    }

    // ============================================================================
    // Приватные обработчики пакетов
    // ============================================================================

    /**
     * 0x04 UserInfo - полная информация о моём персонаже
     */
    private handleUserInfo(data: unknown): void {
        const userInfo = data as {
            objectId: number;
            name: string;
            title: string;
            race: number;
            sex: number;
            classId: number;
            level: number;
            exp: number;
            str: number;
            dex: number;
            con: number;
            int: number;
            wit: number;
            men: number;
            maxHp: number;
            currentHp: number;
            maxMp: number;
            currentMp: number;
            maxCp: number;
            currentCp: number;
            sp: number;
            currentLoad: number;
            maxLoad: number;
            x: number;
            y: number;
            z: number;
            vehicleId: number;
        };

        const me: CharacterMe = {
            objectId: userInfo.objectId,
            name: userInfo.name,
            title: userInfo.title,
            classId: userInfo.classId,
            className: getClassName(userInfo.classId),
            level: userInfo.level,
            x: userInfo.x,
            y: userInfo.y,
            z: userInfo.z,
            heading: 0, // TODO: прочитать из пакета если доступно
            hp: userInfo.currentHp,
            maxHp: userInfo.maxHp,
            mp: userInfo.currentMp,
            maxMp: userInfo.maxMp,
            cp: userInfo.currentCp,
            maxCp: userInfo.maxCp,
            exp: userInfo.exp,
            sp: userInfo.sp,
            str: userInfo.str,
            dex: userInfo.dex,
            con: userInfo.con,
            int: userInfo.int,
            wit: userInfo.wit,
            men: userInfo.men,
            // TODO: Боевые статы нужно читать из пакета или рассчитывать
            pAtk: 0,
            mAtk: 0,
            pDef: 0,
            mDef: 0,
            // TODO: Скорости нужно читать из пакета
            attackSpeed: 0,
            castSpeed: 0,
            runSpeed: 0,
            walkSpeed: 0,
            pvpFlag: false,
            karma: 0,
            isRunning: true,
            isSitting: false,
            isInCombat: false,
            isDead: false,
            clan: null,
            ally: null,
        };

        this.state.me = me;
        this.state.update('me.update', me);
    }

    /**
     * 0x03 CharInfo - информация о других игроках
     */
    private handleCharInfo(data: unknown): void {
        const charInfo = data as {
            objectId: number;
            name: string;
            race: number;
            sex: number;
            classId: number;
            level: number;
            x: number;
            y: number;
            z: number;
            heading: number;
            isRunning: boolean;
            isInCombat: boolean;
            isDead: boolean;
            title: string;
        };

        const distance = this.state.calcDistance(charInfo.x, charInfo.y);
        const isNew = !this.state.players.has(charInfo.objectId);

        const player: Player = {
            objectId: charInfo.objectId,
            name: charInfo.name,
            title: charInfo.title,
            classId: charInfo.classId,
            className: getClassName(charInfo.classId),
            x: charInfo.x,
            y: charInfo.y,
            z: charInfo.z,
            heading: charInfo.heading,
            isRunning: charInfo.isRunning,
            isInCombat: charInfo.isInCombat,
            isDead: charInfo.isDead,
            pvpFlag: false,
            karma: 0,
            clan: null,
            equipment: {}, // TODO: парсить экипировку из пакета
            distanceToMe: distance,
        };

        this.state.players.set(charInfo.objectId, player);

        if (isNew) {
            this.state.update('player.appear', player);
        } else {
            this.state.update('player.update', player);
        }
    }

    /**
     * 0x16 NpcInfo - информация о NPC
     */
    private handleNpcInfo(data: unknown): void {
        const npcInfo = data as {
            objectId: number;
            npcId: number;
            attackable: boolean;
            x: number;
            y: number;
            z: number;
            heading: number;
            name: string;
            title: string;
            level: number;
            isDead: boolean;
            currentHp: number;
            maxHp: number;
        };

        const distance = this.state.calcDistance(npcInfo.x, npcInfo.y);
        const isNew = !this.state.npcs.has(npcInfo.objectId);

        const npc: Npc = {
            objectId: npcInfo.objectId,
            npcId: npcInfo.npcId,
            name: npcInfo.name || getNpcName(npcInfo.npcId),
            title: npcInfo.title,
            x: npcInfo.x,
            y: npcInfo.y,
            z: npcInfo.z,
            heading: npcInfo.heading,
            isAttackable: npcInfo.attackable,
            isDead: npcInfo.isDead,
            isRunning: false, // TODO: определять из пакета
            // TODO: скорости из пакета
            runSpeed: 0,
            walkSpeed: 0,
            distanceToMe: distance,
        };

        this.state.npcs.set(npcInfo.objectId, npc);

        if (isNew) {
            this.state.update('npc.appear', npc);
        } else {
            this.state.update('npc.update', npc);
        }
    }

    /**
     * 0x2E MoveToLocation - движение сущности
     * Примечание: в таблице указан 0x01, но в существующем коде 0x2E
     */
    private handleMoveToLocation(data: unknown): void {
        const moveData = data as {
            objectId: number;
            targetX: number;
            targetY: number;
            targetZ: number;
            originX: number;
            originY: number;
            originZ: number;
            moveSpeed: number;
        };

        const entityType = this.resolveEntityType(moveData.objectId);
        const distance = this.state.calcDistance(moveData.targetX, moveData.targetY);

        // Обновляем позицию сущности
        this.updateEntityPosition(moveData.objectId, moveData.targetX, moveData.targetY, moveData.targetZ);

        this.state.update('entity.move', {
            objectId: moveData.objectId,
            entityType,
            from: { x: moveData.originX, y: moveData.originY, z: moveData.originZ },
            to: { x: moveData.targetX, y: moveData.targetY, z: moveData.targetZ },
            distanceToMe: distance,
            speed: moveData.moveSpeed,
        });
    }

    /**
     * 0x08 DeleteObject - удаление объекта из мира
     */
    private handleDeleteObject(data: DeleteObjectData): void {
        const { objectId } = data;
        const entityType = this.resolveEntityType(objectId);

        // Удаляем из соответствующей коллекции
        switch (entityType) {
            case EntityType.PLAYER:
                this.state.players.delete(objectId);
                break;
            case EntityType.NPC:
                this.state.npcs.delete(objectId);
                break;
            case EntityType.ITEM:
                this.state.items.delete(objectId);
                break;
        }

        this.state.update('entity.despawn', {
            objectId,
            entityType: entityType !== EntityType.UNKNOWN ? entityType : null,
        });
    }

    /**
     * 0x0E StatusUpdate - обновление статуса (HP/MP/CP)
     */
    private handleStatusUpdate(data: unknown): void {
        const statusData = data as {
            objectId: number;
            attributes: Array<{ attributeId: number; value: number }>;
        };

        const hpAttr = statusData.attributes.find(a => a.attributeId === 0x09); // CUR_HP
        const maxHpAttr = statusData.attributes.find(a => a.attributeId === 0x0A); // MAX_HP
        const mpAttr = statusData.attributes.find(a => a.attributeId === 0x0B); // CUR_MP
        const maxMpAttr = statusData.attributes.find(a => a.attributeId === 0x0C); // MAX_MP
        const cpAttr = statusData.attributes.find(a => a.attributeId === 0x21); // CUR_CP
        const maxCpAttr = statusData.attributes.find(a => a.attributeId === 0x22); // MAX_CP

        // Обновляем сущность
        const entityType = this.resolveEntityType(statusData.objectId);
        const update: Record<string, number> = {};

        if (hpAttr) update['hp'] = hpAttr.value;
        if (maxHpAttr) update['maxHp'] = maxHpAttr.value;
        if (mpAttr) update['mp'] = mpAttr.value;
        if (maxMpAttr) update['maxMp'] = maxMpAttr.value;
        if (cpAttr) update['cp'] = cpAttr.value;
        if (maxCpAttr) update['maxCp'] = maxCpAttr.value;

        this.updateEntityVitals(statusData.objectId, entityType, update);

        this.state.update('status.update', {
            objectId: statusData.objectId,
            entityType,
            ...update,
        });
    }

    /**
     * 0x0B SpawnItem - появление предмета в мире
     */
    private handleSpawnItem(data: unknown): void {
        const itemData = data as {
            objectId: number;
            itemId: number;
            x: number;
            y: number;
            z: number;
            stackable: boolean;
            count: number;
        };

        const distance = this.state.calcDistance(itemData.x, itemData.y);

        const item: DroppedItem = {
            objectId: itemData.objectId,
            itemId: itemData.itemId,
            name: getItemName(itemData.itemId),
            count: itemData.count,
            x: itemData.x,
            y: itemData.y,
            z: itemData.z,
            distanceToMe: distance,
        };

        this.state.items.set(itemData.objectId, item);
        this.state.update('item.spawn', item);
    }

    /**
     * 0x0C DropItem - предмет выпал в мире
     */
    private handleDropItem(data: unknown): void {
        const itemData = data as {
            objectId: number;
            itemId: number;
            x: number;
            y: number;
            z: number;
            stackable: boolean;
            count: number;
            droppedById: number;
        };

        const distance = this.state.calcDistance(itemData.x, itemData.y);

        const item: DroppedItem = {
            objectId: itemData.objectId,
            itemId: itemData.itemId,
            name: getItemName(itemData.itemId),
            count: itemData.count,
            x: itemData.x,
            y: itemData.y,
            z: itemData.z,
            distanceToMe: distance,
        };

        this.state.items.set(itemData.objectId, item);
        this.state.update('item.drop', {
            ...item,
            droppedById: itemData.droppedById,
        });
    }

    /**
     * 0x1B ItemList - полный список инвентаря
     */
    private handleItemList(data: unknown): void {
        const listData = data as {
            showWindow: boolean;
            adena: number;
            items: Array<{
                objectId: number;
                itemId: number;
                slot: number;
                count: number;
                enchantLevel: number;
                isEquipped: boolean;
                itemType: number;
                customType1: number;
                customType2: number;
                itemType2: number;
                augmentationId: number;
                mana: number;
            }>;
        };

        // Полная перезапись инвентаря
        this.state.inventory.clear();

        for (const item of listData.items) {
            const inventoryItem: InventoryItem = {
                objectId: item.objectId,
                itemId: item.itemId,
                name: getItemName(item.itemId),
                count: item.count,
                isEquipped: item.isEquipped,
                enchantLevel: item.enchantLevel,
                bodyPart: this.getBodyPartName(item.slot),
                type: this.getItemTypeName(item.itemType),
            };
            this.state.inventory.set(item.objectId, inventoryItem);
        }

        this.state.update('inventory.full', {
            adena: listData.adena,
            items: Array.from(this.state.inventory.values()),
        });
    }

    /**
     * 0x19 InventoryUpdate - частичное обновление инвентаря
     */
    private handleInventoryUpdate(data: unknown): void {
        const updateData = data as {
            changes: Array<{
                changeType: 'ADD' | 'UPDATE' | 'REMOVE';
                objectId: number;
                itemId: number;
                count: number;
                slot: number;
                enchantLevel: number;
                isEquipped: boolean;
                itemType1: number;
                itemType2: number;
                customType1: number;
                customType2: number;
                augmentationId: number;
                mana: number;
            }>;
        };

        const changes: Array<InventoryItem & { changeType: string }> = [];

        for (const change of updateData.changes) {
            if (change.changeType === 'REMOVE') {
                this.state.inventory.delete(change.objectId);
                changes.push({
                    changeType: 'REMOVE',
                    objectId: change.objectId,
                    itemId: change.itemId,
                    name: getItemName(change.itemId),
                    count: change.count,
                    isEquipped: false,
                    enchantLevel: 0,
                    bodyPart: '',
                    type: '',
                });
            } else {
                const item: InventoryItem = {
                    objectId: change.objectId,
                    itemId: change.itemId,
                    name: getItemName(change.itemId),
                    count: change.count,
                    isEquipped: change.isEquipped,
                    enchantLevel: change.enchantLevel,
                    bodyPart: this.getBodyPartName(change.slot),
                    type: this.getItemTypeName(change.itemType1),
                };
                this.state.inventory.set(change.objectId, item);
                changes.push({ ...item, changeType: change.changeType });
            }
        }

        this.state.update('inventory.update', changes);
    }

    /**
     * 0x06 Die - смерть сущности
     */
    private handleDie(data: DieData): void {
        const { objectId } = data;
        const entityType = this.resolveEntityType(objectId);

        this.updateEntityDeathState(objectId, entityType, true);

        this.state.update('entity.die', {
            objectId,
            entityType,
        });
    }

    /**
     * 0x07 Revive - воскрешение сущности
     */
    private handleRevive(data: ReviveData): void {
        const { objectId } = data;
        const entityType = this.resolveEntityType(objectId);

        this.updateEntityDeathState(objectId, entityType, false);

        this.state.update('entity.revive', {
            objectId,
            entityType,
        });
    }

    /**
     * 0x27 TeleportToLocation - телепорт сущности
     */
    private handleTeleportToLocation(data: TeleportToLocationData): void {
        const { objectId, x, y, z } = data;
        const entityType = this.resolveEntityType(objectId);

        this.updateEntityPosition(objectId, x, y, z);

        this.state.update('entity.teleport', {
            objectId,
            entityType,
            x,
            y,
            z,
            distanceToMe: this.state.calcDistance(x, y),
        });
    }

    /**
     * 0x2F ChangeWaitType - изменение состояния сидения/стояния
     */
    private handleChangeWaitType(data: ChangeWaitTypeData): void {
        const { objectId, waitType } = data;
        const isSitting = waitType === 1;

        // Только для моего персонажа
        if (this.state.me && objectId === this.state.me.objectId) {
            this.state.me.isSitting = isSitting;
            this.state.update(isSitting ? 'me.sit' : 'me.stand', {
                objectId,
                isSitting,
            });
        }
        // TODO: Обработка для других игроков если нужно
    }

    /**
     * 0x39 AbnormalStatusUpdate - обновление баффов/дебаффов
     */
    private handleAbnormalStatusUpdate(data: AbnormalStatusUpdateData): void {
        const effects: ActiveEffect[] = data.effects.map(effect => ({
            skillId: effect.skillId,
            skillName: `Skill #${effect.skillId}`, // TODO: словарь скиллов
            level: effect.level,
            remainingSeconds: effect.remainingSeconds,
            isBuff: effect.remainingSeconds > 0,
        }));

        this.state.effects = effects;
        this.state.update('effects.update', effects);
    }

    /**
     * 0x4A CreatureSay - сообщение в чате
     */
    private handleCreatureSay(data: CreatureSayData): void {
        const { messageType, senderName, message } = data;

        const chatType = this.mapChatMessageType(messageType);

        const chatMessage: ChatMessage = {
            timestamp: Date.now(),
            type: chatType,
            sender: senderName,
            message: message,
        };

        // Лимит 200 сообщений
        this.state.chat.push(chatMessage);
        if (this.state.chat.length > 200) {
            this.state.chat.shift();
        }

        this.state.update('chat.message', chatMessage);
    }

    /**
     * 0x58 SkillList - список скиллов
     */
    private handleSkillList(data: unknown): void {
        const skillData = data as {
            skills: Array<{
                skillId: number;
                level: number;
                isPassive: boolean;
            }>;
        };

        const skills: Skill[] = skillData.skills.map(skill => ({
            id: skill.skillId,
            name: `Skill #${skill.skillId}`, // TODO: словарь скиллов
            level: skill.level,
            isPassive: skill.isPassive,
            isToggle: false, // TODO: определять из данных
            isDisabled: false,
            cooldownRemaining: 0,
        }));

        this.state.skills = skills;
        this.state.update('skills.full', skills);
    }

    /**
     * 0x76 MagicSkillUse - использование скилла
     */
    private handleMagicSkillUse(data: MagicSkillUseData): void {
        this.state.update('combat.skill.use', {
            attackerId: data.attackerId,
            targetId: data.targetId,
            skillId: data.skillId,
            skillLevel: data.skillLevel,
            hitTime: data.hitTime,
            reuseDelay: data.reuseDelay,
            source: { x: data.x, y: data.y, z: data.z },
            target: { x: data.targetX, y: data.targetY, z: data.targetZ },
        });
    }

    /**
     * 0xA1 MyTargetSelected - выбор цели
     */
    private handleMyTargetSelected(data: MyTargetSelectedData): void {
        const { objectId, color } = data;

        // Определяем тип цели
        let targetType: TargetType = 'npc';
        let name = '';
        let hp = 0;
        let maxHp = 0;

        if (this.state.me && objectId === this.state.me.objectId) {
            targetType = 'player';
            name = this.state.me.name;
            hp = this.state.me.hp;
            maxHp = this.state.me.maxHp;
        } else if (this.state.players.has(objectId)) {
            targetType = 'player';
            const player = this.state.players.get(objectId)!;
            name = player.name;
            // TODO: HP других игроков не всегда доступно
        } else if (this.state.npcs.has(objectId)) {
            targetType = 'npc';
            const npc = this.state.npcs.get(objectId)!;
            name = npc.name;
            // TODO: HP NPC
        } else if (this.state.items.has(objectId)) {
            targetType = 'item';
            const item = this.state.items.get(objectId)!;
            name = item.name;
        }

        const target: TargetInfo = {
            objectId,
            name,
            type: targetType,
            hp,
            maxHp,
        };

        this.state.target = target;
        this.state.update('target.select', {
            ...target,
            color, // цвет агрессии
            objectId, // для ясности в событии
        });
    }

    /**
     * 0xA6 TargetUnselected - снятие выделения цели
     */
    private handleTargetUnselected(data: TargetUnselectedData): void {
        const { objectId, x, y, z } = data;

        // Обновляем позицию сущности
        this.updateEntityPosition(objectId, x, y, z);

        // Сбрасываем цель только если это наша текущая цель
        if (this.state.target && this.state.target.objectId === objectId) {
            this.state.target = null;
        }

        this.state.update('target.unselect', {
            objectId,
            x,
            y,
            z,
        });
    }

    /**
     * 0x59 StopMove - остановка движения
     */
    private handleStopMove(data: StopMoveData): void {
        const { objectId, x, y, z, heading } = data;
        const entityType = this.resolveEntityType(objectId);

        this.updateEntityPosition(objectId, x, y, z, heading);

        this.state.update('entity.stop', {
            objectId,
            entityType,
            x,
            y,
            z,
            heading,
            distanceToMe: this.state.calcDistance(x, y),
        });
    }

    /**
     * 0x05 Attack - атака и урон
     */
    private handleAttack(data: AttackData): void {
        const { attackerId, targetId, hits } = data;
        const attackerType = this.resolveEntityType(attackerId);
        const targetType = this.resolveEntityType(targetId);

        // Обновляем combat статус для атакующего
        this.updateEntityCombatState(attackerId, attackerType, true);

        // Отправляем событие combat.attack
        this.state.update('combat.attack', {
            attackerId,
            attackerType,
            targetId,
            targetType,
            hits: hits.map(hit => ({
                targetId: hit.targetId,
                damage: hit.damage,
                isMiss: (hit.flags & 0x10) !== 0,
                isCritical: (hit.flags & 0x20) !== 0,
                isShielded: (hit.flags & 0x40) !== 0,
            })),
            totalDamage: hits.reduce((sum, hit) => sum + hit.damage, 0),
            timestamp: Date.now(),
        });
    }

    /**
     * Обновляет combat состояние сущности
     */
    private updateEntityCombatState(
        objectId: number,
        entityType: EntityType,
        inCombat: boolean
    ): void {
        if (entityType === EntityType.ME && this.state.me) {
            this.state.me.isInCombat = inCombat;
        } else if (entityType === EntityType.PLAYER) {
            const player = this.state.players.get(objectId);
            if (player) {
                player.isInCombat = inCombat;
            }
        }
        // Для NPC combat state обычно не отслеживается в GameState
    }

    // ============================================================================
    // Вспомогательные методы
    // ============================================================================

    /**
     * Определяет тип сущности по objectId
     */
    private resolveEntityType(objectId: number): EntityType {
        if (this.state.me && objectId === this.state.me.objectId) {
            return EntityType.ME;
        }
        if (this.state.players.has(objectId)) {
            return EntityType.PLAYER;
        }
        if (this.state.npcs.has(objectId)) {
            return EntityType.NPC;
        }
        if (this.state.items.has(objectId)) {
            return EntityType.ITEM;
        }
        return EntityType.UNKNOWN;
    }

    /**
     * Обновляет позицию сущности
     */
    private updateEntityPosition(
        objectId: number,
        x: number,
        y: number,
        z: number,
        heading?: number
    ): void {
        // Обновляем me
        if (this.state.me && objectId === this.state.me.objectId) {
            this.state.me.x = x;
            this.state.me.y = y;
            this.state.me.z = z;
            if (heading !== undefined) {
                this.state.me.heading = heading;
            }
            return;
        }

        // Обновляем player
        const player = this.state.players.get(objectId);
        if (player) {
            player.x = x;
            player.y = y;
            player.z = z;
            if (heading !== undefined) {
                player.heading = heading;
            }
            player.distanceToMe = this.state.calcDistance(x, y);
            return;
        }

        // Обновляем NPC
        const npc = this.state.npcs.get(objectId);
        if (npc) {
            npc.x = x;
            npc.y = y;
            npc.z = z;
            if (heading !== undefined) {
                npc.heading = heading;
            }
            npc.distanceToMe = this.state.calcDistance(x, y);
            return;
        }

        // Обновляем предмет
        const item = this.state.items.get(objectId);
        if (item) {
            item.x = x;
            item.y = y;
            item.z = z;
            item.distanceToMe = this.state.calcDistance(x, y);
        }
    }

    /**
     * Обновляет жизненные показатели сущности
     */
    private updateEntityVitals(
        objectId: number,
        _entityType: EntityType,
        update: Record<string, number>
    ): void {
        // Обновляем me
        if (this.state.me && objectId === this.state.me.objectId) {
            if (update['hp'] !== undefined) this.state.me.hp = update['hp'];
            if (update['maxHp'] !== undefined) this.state.me.maxHp = update['maxHp'];
            if (update['mp'] !== undefined) this.state.me.mp = update['mp'];
            if (update['maxMp'] !== undefined) this.state.me.maxMp = update['maxMp'];
            if (update['cp'] !== undefined) this.state.me.cp = update['cp'];
            if (update['maxCp'] !== undefined) this.state.me.maxCp = update['maxCp'];
            return;
        }

        // TODO: Обновление HP/MP для других сущностей если доступно
    }

    /**
     * Обновляет состояние смерти сущности
     */
    private updateEntityDeathState(
        objectId: number,
        _entityType: EntityType,
        isDead: boolean
    ): void {
        if (this.state.me && objectId === this.state.me.objectId) {
            this.state.me.isDead = isDead;
            return;
        }

        const player = this.state.players.get(objectId);
        if (player) {
            player.isDead = isDead;
            return;
        }

        const npc = this.state.npcs.get(objectId);
        if (npc) {
            npc.isDead = isDead;
        }
    }

    /**
     * Преобразует тип чат-сообщения
     */
    private mapChatMessageType(type: number): ChatMessageType {
        const typeMap: Record<number, ChatMessageType> = {
            0: 'all',
            1: 'shout',
            2: 'whisper',
            3: 'party',
            4: 'clan',
            8: 'trade',
            9: 'hero',
            10: 'system',
        };
        return typeMap[type] ?? 'all';
    }

    /**
     * Возвращает название слота экипировки
     */
    private getBodyPartName(slot: number): string {
        const slotNames: Record<number, string> = {
            0: 'none',
            1: 'underwear',
            2: 'earring',
            4: 'earring',
            8: 'necklace',
            16: 'ring',
            32: 'ring',
            64: 'head',
            128: 'gloves',
            256: 'chest',
            512: 'legs',
            1024: 'feet',
            2048: 'back',
            4096: 'lrhand',
            8192: 'hair',
        };
        return slotNames[slot] ?? `slot_${slot}`;
    }

    /**
     * Возвращает тип предмета
     */
    private getItemTypeName(itemType: number): string {
        const typeNames: Record<number, string> = {
            0: 'weapon',
            1: 'armor',
            2: 'accessory',
            3: 'quest',
            4: 'asset',
            5: 'etc',
        };
        return typeNames[itemType] ?? `type_${itemType}`;
    }
}
