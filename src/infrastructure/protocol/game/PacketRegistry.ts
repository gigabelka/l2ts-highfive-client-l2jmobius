/**
 * @fileoverview PacketRegistry - автоматическая регистрация пакетов и обработчиков
 * Централизованная конфигурация ВСЕХ игровых пакетов L2J Mobius
 *
 * COMPATIBILITY NOTE: Currently configured for CT_0_Interlude (protocol 746).
 * For HighFive (protocol 267), some opcodes may need adjustment after testing.
 * Most server-to-client opcodes are typically stable between L2J Mobius versions.
 *
 * @module infrastructure/protocol/game
 */

import type { IEventBus, IPacketProcessor, IIncomingPacket } from '../../../application/ports';
import type { ICharacterRepository, IWorldRepository, IInventoryRepository } from '../../../domain/repositories';
import { GameIncomingPacketFactory } from './GameIncomingPacketFactory';

// =====================================================================
// Packets с полным парсингом
// =====================================================================
import { UserInfoPacket } from './packets/UserInfoPacket';
import { NpcInfoPacket } from './packets/NpcInfoPacket';
import { CharInfoPacket } from './packets/CharInfoPacket';
import { ItemListPacket } from './packets/ItemListPacket';
import { InventoryUpdatePacket } from './packets/InventoryUpdatePacket';
import { SkillListPacket } from './packets/SkillListPacket';
import { AttackPacket } from './packets/AttackPacket';
import { MoveToLocationPacket } from './packets/MoveToLocationPacket';
import { SpawnItemPacket } from './packets/SpawnItemPacket';
import { DropItemPacket } from './packets/DropItemPacket';
import { StatusUpdatePacket } from './packets/StatusUpdatePacket';
import { DeleteObjectPacket } from './packets/DeleteObjectPacket';
import { CreatureSayPacket } from './packets/CreatureSayPacket';
import { DiePacket } from './packets/DiePacket';
import { RevivePacket } from './packets/RevivePacket';
import { AbnormalStatusUpdatePacket } from './packets/AbnormalStatusUpdatePacket';
import { MagicSkillUsePacket } from './packets/MagicSkillUsePacket';
import { MyTargetSelectedPacket } from './packets/MyTargetSelectedPacket';
import { TargetUnselectedPacket } from './packets/TargetUnselectedPacket';
import { TeleportToLocationPacket } from './packets/TeleportToLocationPacket';
import { ChangeWaitTypePacket } from './packets/ChangeWaitTypePacket';
import { StopMovePacket } from './packets/StopMovePacket';

// Новые пакеты с парсингом (без handlers)
import { SystemMessagePacket } from './packets/SystemMessagePacket';
import { NpcSayPacket } from './packets/NpcSayPacket';
import { NpcHtmlMessagePacket } from './packets/NpcHtmlMessagePacket';
import { ActionFailedPacket } from './packets/ActionFailedPacket';
import { TargetSelectedPacket } from './packets/TargetSelectedPacket';
import { SocialActionPacket } from './packets/SocialActionPacket';
import { ChangeMoveTypePacket } from './packets/ChangeMoveTypePacket';
import { ValidateLocationPacket } from './packets/ValidateLocationPacket';
import { GetItemPacket } from './packets/GetItemPacket';
import { MagicSkillLaunchedPacket } from './packets/MagicSkillLaunchedPacket';
import { AutoAttackStartPacket } from './packets/AutoAttackStartPacket';
import { AutoAttackStopPacket } from './packets/AutoAttackStopPacket';
import { MoveToPawnPacket } from './packets/MoveToPawnPacket';
import { SetupGaugePacket } from './packets/SetupGaugePacket';
import { ExPacket } from './packets/ExPacket';

// Generic пакет для распознанных опкодов без парсера
import { createGenericPacketClass } from './packets/GenericServerPacket';

// =====================================================================
// Handlers
// =====================================================================
import { UserInfoHandler } from './handlers/UserInfoHandler';
import { NpcInfoHandler } from './handlers/NpcInfoHandler';
import { CharInfoHandler } from './handlers/CharInfoHandler';
import { ItemListHandler } from './handlers/ItemListHandler';
import { InventoryUpdateHandler } from './handlers/InventoryUpdateHandler';
import { SkillListHandler } from './handlers/SkillListHandler';
import { AttackHandler } from './handlers/AttackHandler';
import { MoveToLocationHandler } from './handlers/MoveToLocationHandler';
import { SpawnItemHandler } from './handlers/SpawnItemHandler';
import { DropItemHandler } from './handlers/DropItemHandler';
import { StatusUpdateHandler } from './handlers/StatusUpdateHandler';
import { DeleteObjectHandler } from './handlers/DeleteObjectHandler';
import { CreatureSayHandler } from './handlers/CreatureSayHandler';
import { DieHandler } from './handlers/DieHandler';
import { ReviveHandler } from './handlers/ReviveHandler';
import { AbnormalStatusUpdateHandler } from './handlers/AbnormalStatusUpdateHandler';
import { MagicSkillUseHandler } from './handlers/MagicSkillUseHandler';
import { MyTargetSelectedHandler } from './handlers/MyTargetSelectedHandler';
import { TargetUnselectedHandler } from './handlers/TargetUnselectedHandler';
import { TeleportToLocationHandler } from './handlers/TeleportToLocationHandler';
import { ChangeWaitTypeHandler } from './handlers/ChangeWaitTypeHandler';
import { StopMoveHandler } from './handlers/StopMoveHandler';

/**
 * Конфигурация пакета
 */
interface PacketConfig {
    opcode: number;
    packetClass: new () => IIncomingPacket;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handlerClass?: new (
        eventBus: IEventBus,
        ...repos: any[]
    ) => import('../../../application/ports').IPacketHandlerStrategy;
    repositories?: Array<'character' | 'world' | 'inventory'>;
    description?: string;
}

// =====================================================================
// РАЗДЕЛ 1: Пакеты с полными обработчиками (handler + parser)
// Обновляют GameState через handlers и EventBus
//
// NOTE: Opcodes configured for L2J Mobius CT_0_Interlude (protocol 746).
// For HighFive (protocol 267), verification needed during testing.
// =====================================================================
const HANDLED_PACKETS: PacketConfig[] = [
    // ---- MoveToLocation (0x01) — L2J Mobius opcode ----
    {
        opcode: 0x01,
        packetClass: MoveToLocationPacket,
        handlerClass: MoveToLocationHandler,
        repositories: ['character', 'world'],
        description: 'MoveToLocation - движение сущностей (L2J Mobius opcode)',
    },
    {
        opcode: 0x03,
        packetClass: CharInfoPacket,
        handlerClass: CharInfoHandler,
        repositories: ['world'],
        description: 'CharInfo - информация о других игроках',
    },
    {
        opcode: 0x04,
        packetClass: UserInfoPacket,
        handlerClass: UserInfoHandler,
        repositories: ['character'],
        description: 'UserInfo - полная информация о персонаже',
    },
    {
        opcode: 0x05,
        packetClass: AttackPacket,
        handlerClass: AttackHandler,
        repositories: ['character'],
        description: 'Attack - атака и урон',
    },
    {
        opcode: 0x06,
        packetClass: DiePacket,
        handlerClass: DieHandler,
        repositories: ['character', 'world'],
        description: 'Die - смерть сущности',
    },
    {
        opcode: 0x07,
        packetClass: RevivePacket,
        handlerClass: ReviveHandler,
        repositories: ['character', 'world'],
        description: 'Revive - воскрешение сущности',
    },
    {
        opcode: 0x08,
        packetClass: DeleteObjectPacket,
        handlerClass: DeleteObjectHandler,
        repositories: ['character', 'world'],
        description: 'DeleteObject - удаление объекта из мира',
    },
    {
        opcode: 0x0B,
        packetClass: SpawnItemPacket,
        handlerClass: SpawnItemHandler,
        repositories: ['world'],
        description: 'SpawnItem - появление предмета в мире',
    },
    {
        opcode: 0x0C,
        packetClass: DropItemPacket,
        handlerClass: DropItemHandler,
        repositories: ['world'],
        description: 'DropItem - выпадение предмета',
    },
    {
        opcode: 0x0E,
        packetClass: StatusUpdatePacket,
        handlerClass: StatusUpdateHandler,
        repositories: ['character', 'world'],
        description: 'StatusUpdate - обновление HP/MP/CP',
    },
    {
        opcode: 0x16,
        packetClass: NpcInfoPacket,
        handlerClass: NpcInfoHandler,
        repositories: ['world'],
        description: 'NpcInfo - информация о NPC',
    },
    {
        opcode: 0x19,
        packetClass: InventoryUpdatePacket,
        handlerClass: InventoryUpdateHandler,
        repositories: ['inventory', 'character'],
        description: 'InventoryUpdate - частичное обновление инвентаря',
    },
    {
        opcode: 0x1B,
        packetClass: ItemListPacket,
        handlerClass: ItemListHandler,
        repositories: ['inventory', 'character'],
        description: 'ItemList - полный список предметов',
    },
    {
        opcode: 0x27,
        packetClass: TeleportToLocationPacket,
        handlerClass: TeleportToLocationHandler,
        repositories: ['character', 'world'],
        description: 'TeleportToLocation - телепорт сущности',
    },
    // ---- MoveToLocation (0x2E) — запасной/альтернативный опкод ----
    {
        opcode: 0x2E,
        packetClass: MoveToLocationPacket,
        handlerClass: MoveToLocationHandler,
        repositories: ['character', 'world'],
        description: 'MoveToLocation - движение сущностей (альтернативный опкод)',
    },
    {
        opcode: 0x2F,
        packetClass: ChangeWaitTypePacket,
        handlerClass: ChangeWaitTypeHandler,
        repositories: ['character', 'world'],
        description: 'ChangeWaitType - изменение состояния сидения/стояния',
    },
    {
        opcode: 0x39,
        packetClass: AbnormalStatusUpdatePacket,
        handlerClass: AbnormalStatusUpdateHandler,
        repositories: ['character'],
        description: 'AbnormalStatusUpdate - обновление баффов/дебаффов',
    },
    {
        opcode: 0x4A,
        packetClass: CreatureSayPacket,
        handlerClass: CreatureSayHandler,
        repositories: ['character'],
        description: 'CreatureSay - сообщение в чате',
    },
    {
        opcode: 0x58,
        packetClass: SkillListPacket,
        handlerClass: SkillListHandler,
        repositories: ['character'],
        description: 'SkillList - список скиллов',
    },
    {
        opcode: 0x59,
        packetClass: StopMovePacket,
        handlerClass: StopMoveHandler,
        repositories: ['character', 'world'],
        description: 'StopMove - остановка движения',
    },
    {
        opcode: 0x76,
        packetClass: MagicSkillUsePacket,
        handlerClass: MagicSkillUseHandler,
        repositories: ['character', 'world'],
        description: 'MagicSkillUse - использование скилла',
    },
    {
        opcode: 0xA1,
        packetClass: MyTargetSelectedPacket,
        handlerClass: MyTargetSelectedHandler,
        repositories: ['character', 'world'],
        description: 'MyTargetSelected - выбор цели',
    },
    {
        opcode: 0xA6,
        packetClass: TargetUnselectedPacket,
        handlerClass: TargetUnselectedHandler,
        repositories: ['character'],
        description: 'TargetUnselected - сброс цели',
    },
];

// =====================================================================
// РАЗДЕЛ 2: Пакеты с парсерами, но без handlers
// Распознаются и парсятся, но пока не обновляют GameState
// =====================================================================
const PARSED_PACKETS: PacketConfig[] = [
    { opcode: 0x02, packetClass: NpcSayPacket, description: 'NpcSay - сообщение от NPC' },
    { opcode: 0x09, packetClass: StopMovePacket, description: 'StopMove - остановка движения (альт. опкод)' },
    { opcode: 0x0D, packetClass: GetItemPacket, description: 'GetItem - подбор предмета с земли' },
    { opcode: 0x0F, packetClass: NpcHtmlMessagePacket, description: 'NpcHtmlMessage - HTML диалог от NPC' },
    { opcode: 0x1C, packetClass: TargetSelectedPacket, description: 'TargetSelected - выбор цели другим игроком' },
    { opcode: 0x1D, packetClass: TargetUnselectedPacket, description: 'TargetUnselected - сброс цели (альт. опкод)' },
    { opcode: 0x1E, packetClass: AutoAttackStartPacket, description: 'AutoAttackStart - начало автоатаки' },
    { opcode: 0x1F, packetClass: AutoAttackStopPacket, description: 'AutoAttackStop - окончание автоатаки' },
    { opcode: 0x20, packetClass: SocialActionPacket, description: 'SocialAction - социальные действия/эмоции' },
    { opcode: 0x25, packetClass: ActionFailedPacket, description: 'ActionFailed - действие отклонено сервером' },
    { opcode: 0x28, packetClass: ChangeMoveTypePacket, description: 'ChangeMoveType - бег/ходьба' },
    { opcode: 0x29, packetClass: TargetSelectedPacket, description: 'TargetSelected - выбор цели (альт. опкод)' },
    { opcode: 0x2D, packetClass: SocialActionPacket, description: 'SocialAction - социальные действия (альт. опкод)' },
    { opcode: 0x38, packetClass: TeleportToLocationPacket, description: 'TeleportToLocation - телепорт (альт. опкод)' },
    { opcode: 0x3E, packetClass: ChangeMoveTypePacket, description: 'ChangeMoveType - бег/ходьба (альт. опкод)' },
    { opcode: 0x3F, packetClass: ValidateLocationPacket, description: 'ValidateLocation - валидация позиции' },

    { opcode: 0x48, packetClass: MagicSkillLaunchedPacket, description: 'MagicSkillLaunched - подтверждение запуска скилла' },
    { opcode: 0x54, packetClass: MagicSkillLaunchedPacket, description: 'MagicSkillLaunched - запуск скилла (альт. опкод)' },
    { opcode: 0x60, packetClass: MoveToPawnPacket, description: 'MoveToPawn - следование за целью' },
    { opcode: 0x61, packetClass: ValidateLocationPacket, description: 'ValidateLocation - валидация позиции (альт. опкод)' },
    { opcode: 0x62, packetClass: SystemMessagePacket, description: 'SystemMessage - системное сообщение' },
    { opcode: 0x64, packetClass: SetupGaugePacket, description: 'SetupGauge - прогрессбар каста/сбора' },
    { opcode: 0x6D, packetClass: SetupGaugePacket, description: 'SetupGauge - прогрессбар (альт. опкод)' },
    { opcode: 0xFE, packetClass: ExPacket, description: 'ExPacket - расширенный пакет с суб-опкодом' },
];

// =====================================================================
// РАЗДЕЛ 3: Распознанные пакеты без парсера (Generic)
// Показывают имя вместо "UnknownPacket", сохраняют raw данные
// =====================================================================
interface GenericPacketDef {
    opcode: number;
    name: string;
    description: string;
}

const GENERIC_PACKETS: GenericPacketDef[] = [
    // --- Авторизация / Лобби ---
    { opcode: 0x00, name: 'CryptInit', description: 'CryptInit - инициализация шифрования (handshake)' },
    { opcode: 0x0A, name: 'SunRise', description: 'SunRise - восход солнца' },
    { opcode: 0x10, name: 'SellList', description: 'SellList - список продажи NPC' },
    { opcode: 0x11, name: 'BuyList', description: 'BuyList - список покупки NPC' },
    { opcode: 0x12, name: 'ShowMinimap', description: 'ShowMinimap / CharCreateOk' },
    { opcode: 0x13, name: 'CharSelectInfo', description: 'CharSelectInfo - список персонажей' },
    { opcode: 0x14, name: 'LoginFail', description: 'LoginFail - ошибка логина' },
    { opcode: 0x15, name: 'CharSelected', description: 'CharSelected - подтверждение выбора персонажа' },
    { opcode: 0x17, name: 'CharTemplates', description: 'CharTemplates - шаблоны создания персонажа' },
    { opcode: 0x18, name: 'StaticObject', description: 'StaticObject - статический объект (дверь, колонна)' },
    { opcode: 0x1A, name: 'TitleUpdate', description: 'TitleUpdate - обновление титула' },
    { opcode: 0x21, name: 'SetSummonRemainTime', description: 'SetSummonRemainTime - оставшееся время саммона' },
    { opcode: 0x22, name: 'SkillCoolTime', description: 'SkillCoolTime - перезарядка скиллов' },
    { opcode: 0x23, name: 'AskJoinPledge', description: 'AskJoinPledge - приглашение в клан' },
    { opcode: 0x24, name: 'PledgeShowInfoUpdate', description: 'PledgeShowInfoUpdate - информация о клане' },
    { opcode: 0x26, name: 'AutoAttackStop2', description: 'AutoAttackStop - окончание автоатаки (альт.)' },
    { opcode: 0x2A, name: 'AskJoinParty', description: 'AskJoinParty - приглашение в группу' },
    { opcode: 0x2B, name: 'JoinParty', description: 'JoinParty - подтверждение группы' },
    { opcode: 0x2C, name: 'RestartResponse', description: 'RestartResponse / CharCreateOk' },
    { opcode: 0x30, name: 'MagicSkillCanceld', description: 'MagicSkillCanceld - отмена каста' },
    { opcode: 0x31, name: 'EquipUpdate', description: 'EquipUpdate - обновление экипировки' },
    { opcode: 0x32, name: 'EtcStatusUpdate', description: 'EtcStatusUpdate - обновление веса/штрафов' },
    { opcode: 0x33, name: 'ShortBuffStatusUpdate', description: 'ShortBuffStatusUpdate - обновление коротких баффов' },
    { opcode: 0x34, name: 'MoveToLocationInVehicle', description: 'MoveToLocationInVehicle - движение в транспорте' },
    { opcode: 0x35, name: 'StopMoveInVehicle', description: 'StopMoveInVehicle - остановка в транспорте' },
    { opcode: 0x36, name: 'ValidateLocationInVehicle', description: 'ValidateLocationInVehicle - валидация в транспорте' },
    { opcode: 0x37, name: 'PetStatusShow', description: 'PetStatusShow - статус пета' },
    { opcode: 0x3A, name: 'PetInfo', description: 'PetInfo - информация о пете' },
    { opcode: 0x3B, name: 'PetItemList', description: 'PetItemList - инвентарь пета' },
    { opcode: 0x3C, name: 'PetStatusUpdate', description: 'PetStatusUpdate - обновление статуса пета' },
    { opcode: 0x3D, name: 'ServerCloseSocket', description: 'ServerCloseSocket - сервер закрывает соединение' },
    { opcode: 0x40, name: 'PartySmallWindowAll', description: 'PartySmallWindowAll - информация о группе' },
    { opcode: 0x41, name: 'PartySmallWindowAdd', description: 'PartySmallWindowAdd - добавление в группу' },
    { opcode: 0x42, name: 'PartySmallWindowDeleteAll', description: 'PartySmallWindowDeleteAll - расформирование группы' },
    { opcode: 0x43, name: 'PartySmallWindowDelete', description: 'PartySmallWindowDelete - выход из группы' },
    { opcode: 0x44, name: 'PartySmallWindowUpdate', description: 'PartySmallWindowUpdate - обновление группы' },
    { opcode: 0x45, name: 'PledgeShowMemberListAll', description: 'PledgeShowMemberListAll - полный список клана' },
    { opcode: 0x46, name: 'PledgeShowMemberListUpdate', description: 'PledgeShowMemberListUpdate - обновление списка клана' },
    { opcode: 0x49, name: 'PledgeShowMemberListAdd', description: 'PledgeShowMemberListAdd - добавление в клан' },
    { opcode: 0x4B, name: 'PledgeReceiveSubPledgeCreated', description: 'PledgeReceiveSubPledgeCreated - создание под-клана' },
    { opcode: 0x4C, name: 'PledgeReceiveMemberInfo', description: 'PledgeReceiveMemberInfo - информация о члене клана' },
    { opcode: 0x4D, name: 'PledgeStatusChanged', description: 'PledgeStatusChanged - статус клана изменён' },
    { opcode: 0x4E, name: 'PledgeShowMemberListDelete', description: 'PledgeShowMemberListDelete - удаление из клана' },
    { opcode: 0x4F, name: 'ShowBoard', description: 'ShowBoard - community board' },
    { opcode: 0x50, name: 'CloseBoardServer', description: 'CloseBoardServer - закрытие community board' },
    { opcode: 0x51, name: 'ShowBoardHtml', description: 'ShowBoardHtml - HTML community board' },
    { opcode: 0x52, name: 'WareHouseDepositList', description: 'WareHouseDepositList - склад (вложение)' },
    { opcode: 0x53, name: 'WareHouseWithdrawalList', description: 'WareHouseWithdrawalList - склад (изъятие)' },
    { opcode: 0x55, name: 'MagicEffectIcons', description: 'MagicEffectIcons - иконки эффектов (баффы/дебаффы)' },
    { opcode: 0x56, name: 'QuestList', description: 'QuestList - список квестов' },
    { opcode: 0x57, name: 'EnchantResult', description: 'EnchantResult - результат заточки' },
    { opcode: 0x5A, name: 'PledgeCrest', description: 'PledgeCrest - герб клана' },
    { opcode: 0x5B, name: 'MoveToPawn2', description: 'MoveToPawn - следование за целью (альт.)' },
    { opcode: 0x5C, name: 'SSQInfo', description: 'SSQInfo - Seven Signs информация' },
    { opcode: 0x5D, name: 'PetDelete', description: 'PetDelete - удаление пета' },
    { opcode: 0x5E, name: 'Dice', description: 'Dice - бросок кубика' },
    { opcode: 0x5F, name: 'SkillCoolTime2', description: 'SkillCoolTime - перезарядка (версия 2)' },
    { opcode: 0x63, name: 'Snoop', description: 'Snoop - слежка за чатом' },
    { opcode: 0x65, name: 'ShortCutInit', description: 'ShortCutInit - панель быстрого доступа' },
    { opcode: 0x66, name: 'ShortCutRegister', description: 'ShortCutRegister - регистрация шортката' },
    { opcode: 0x67, name: 'ShortCutDelete', description: 'ShortCutDelete - удаление шортката' },
    { opcode: 0x68, name: 'RecipeShopSellList', description: 'RecipeShopSellList - рецепты магазина' },
    { opcode: 0x69, name: 'RecipeShopItemInfo', description: 'RecipeShopItemInfo - информация о рецепте' },
    { opcode: 0x6A, name: 'RecipeBookItemList', description: 'RecipeBookItemList - книга рецептов' },
    { opcode: 0x6B, name: 'RecipeShopMsg', description: 'RecipeShopMsg - сообщение магазина рецептов' },
    { opcode: 0x6C, name: 'RecipeItemMakeInfo', description: 'RecipeItemMakeInfo - информация о крафте' },
    { opcode: 0x6E, name: 'ObservationMode', description: 'ObservationMode - режим наблюдения' },
    { opcode: 0x6F, name: 'ObservationReturn', description: 'ObservationReturn - выход из наблюдения' },
    { opcode: 0x70, name: 'HennaInfo', description: 'HennaInfo - информация о татуировках' },
    { opcode: 0x47, name: 'StopMove', description: 'StopMove - остановка движения' },
    { opcode: 0x71, name: 'HennaItemInfo', description: 'HennaItemInfo - информация о татуировке' },
    { opcode: 0x72, name: 'HennaEquipList', description: 'HennaEquipList - список доступных татуировок' },
    { opcode: 0x73, name: 'HennaItemRemoveList', description: 'HennaItemRemoveList - удаление татуировки' },
    { opcode: 0x74, name: 'AllyCrest', description: 'AllyCrest - герб альянса' },
    { opcode: 0x75, name: 'PledgePowerGradeList', description: 'PledgePowerGradeList - ранги клана' },
    { opcode: 0x77, name: 'ShowCalc', description: 'ShowCalc - калькулятор' },
    { opcode: 0x78, name: 'MagicSkillCancel', description: 'MagicSkillCancel - отмена скилла' },
    { opcode: 0x79, name: 'Earthquake', description: 'Earthquake - эффект землетрясения' },
    { opcode: 0x7A, name: 'FlyToLocation', description: 'FlyToLocation - полёт к позиции (knockback/pull)' },
    { opcode: 0x7B, name: 'MultiSellList', description: 'MultiSellList - мультиселл' },
    { opcode: 0x7C, name: 'SetPledgeCrest', description: 'SetPledgeCrest - установка герба клана' },
    { opcode: 0x7D, name: 'PledgeCrestLarge', description: 'PledgeCrestLarge - большой герб клана' },
    { opcode: 0x7E, name: 'LogoutOk', description: 'LogoutOk - успешный выход' },
    { opcode: 0x80, name: 'QuestList2', description: 'QuestList - список квестов (версия 2)' },
    { opcode: 0x81, name: 'AbnormalVisualEffect', description: 'AbnormalVisualEffect - визуальный эффект' },
    { opcode: 0x82, name: 'SpecialCamera', description: 'SpecialCamera - камера катсцены' },
    { opcode: 0x83, name: 'NormalCamera', description: 'NormalCamera - нормальная камера' },
    { opcode: 0x84, name: 'ItemEffectAnimation', description: 'ItemEffectAnimation - анимация предмета' },
    { opcode: 0x85, name: 'ConfirmDlg', description: 'ConfirmDlg - диалог подтверждения' },
    { opcode: 0x86, name: 'PartySpelled', description: 'PartySpelled - эффект на члена группы' },
    { opcode: 0x87, name: 'ShopPreviewList', description: 'ShopPreviewList - предпросмотр магазина' },
    { opcode: 0x88, name: 'Ride', description: 'Ride - посадка на маунта' },
    { opcode: 0x89, name: 'EnchantPutItemOk', description: 'EnchantPutItemOk - заточка вставка ОК' },
    { opcode: 0x8A, name: 'EnchantPutItemCancel', description: 'EnchantPutItemCancel - заточка отмена' },
    { opcode: 0x8B, name: 'FriendList', description: 'FriendList - список друзей' },
    { opcode: 0x8C, name: 'MagicEffectIcons2', description: 'MagicEffectIcons - иконки эффектов (версия 2)' },
    { opcode: 0x8D, name: 'FriendAddRequest', description: 'FriendAddRequest - запрос в друзья' },
    { opcode: 0x8E, name: 'HennaUnequipInfo', description: 'HennaUnequipInfo - снятие татуировки' },
    { opcode: 0x90, name: 'ManorList', description: 'ManorList - список маноров' },
    { opcode: 0x91, name: 'ShowTutorialHtml', description: 'ShowTutorialHtml - HTML туториала' },
    { opcode: 0x92, name: 'TutorialShowQuestionMark', description: 'TutorialShowQuestionMark - знак вопроса туториала' },
    { opcode: 0x93, name: 'TutorialEnableClientEvent', description: 'TutorialEnableClientEvent - включение событий туториала' },
    { opcode: 0x94, name: 'TutorialCloseHtml', description: 'TutorialCloseHtml - закрытие HTML туториала' },
    { opcode: 0x95, name: 'PrivateStoreSellManageList', description: 'PrivateStoreSellManageList - управление приватным магазином' },
    { opcode: 0x96, name: 'PrivateStoreSellList', description: 'PrivateStoreSellList - приватный магазин продажи' },
    { opcode: 0x97, name: 'PrivateStoreSellMsg', description: 'PrivateStoreSellMsg - сообщение приватного магазина' },
    { opcode: 0x98, name: 'CastleSiegeInfo', description: 'CastleSiegeInfo - информация об осаде' },
    { opcode: 0x99, name: 'CastleSiegeAttackerList', description: 'CastleSiegeAttackerList - список атакующих' },
    { opcode: 0x9A, name: 'CastleSiegeDefenderList', description: 'CastleSiegeDefenderList - список защитников' },
    { opcode: 0x9B, name: 'NicknameChanged', description: 'NicknameChanged - изменение ника' },
    { opcode: 0x9C, name: 'PledgeShowInfoUpdate2', description: 'PledgeShowInfoUpdate - информация клана (версия 2)' },
    { opcode: 0x9D, name: 'PledgeReceiveWarList', description: 'PledgeReceiveWarList - список войн клана' },
    { opcode: 0xA0, name: 'ManorList2', description: 'ManorList - список маноров (версия 2)' },
    { opcode: 0xA2, name: 'ShowMinimap2', description: 'ShowMinimap - мини-карта (версия 2)' },
    { opcode: 0xA3, name: 'ReviveRequest', description: 'ReviveRequest - запрос воскрешения' },
    { opcode: 0xA4, name: 'AbnormalStatusUpdate2', description: 'AbnormalStatusUpdate - обновление эффектов (версия 2)' },
    { opcode: 0xA5, name: 'SummonInfo', description: 'SummonInfo / SiegeInfo' },
    { opcode: 0xA7, name: 'MyTargetSelected2', description: 'MyTargetSelected - альт. опкод' },
    { opcode: 0xA8, name: 'PartyMemberPosition', description: 'PartyMemberPosition - позиции членов группы' },
    { opcode: 0xA9, name: 'AskJoinAlly', description: 'AskJoinAlly - приглашение в альянс' },
    { opcode: 0xB0, name: 'SurrenderPledgeWar', description: 'SurrenderPledgeWar - сдача в клановой войне' },
    { opcode: 0xB1, name: 'PledgeReceiveSubPledge', description: 'PledgeReceiveSubPledge - информация о под-клане' },
    { opcode: 0xB5, name: 'FortressSiegeInfo', description: 'FortressSiegeInfo - информация об осаде форта' },
    { opcode: 0xB7, name: 'ShowXMasSeal', description: 'ShowXMasSeal - новогодний ивент' },
    { opcode: 0xB9, name: 'PrivateStoreListSell', description: 'PrivateStoreListSell - приватный магазин продажи' },
    { opcode: 0xBE, name: 'PrivateStoreListBuy', description: 'PrivateStoreListBuy - приватный магазин покупки' },
    { opcode: 0xC0, name: 'ExOlympiadMatchList', description: 'ExOlympiadMatchList - олимпиадные матчи' },
    { opcode: 0xD3, name: 'NetPingRequest', description: 'NetPingRequest - запрос пинга от сервера' },
    { opcode: 0xE0, name: 'PledgeSkillList', description: 'PledgeSkillList - скиллы клана' },
    { opcode: 0xE1, name: 'PledgeSkillListAdd', description: 'PledgeSkillListAdd - добавление скилла клана' },
    { opcode: 0xE4, name: 'RelationChanged', description: 'RelationChanged - изменение отношений' },
    { opcode: 0xE7, name: 'SkillRemainSec', description: 'SkillRemainSec - оставшееся время скилла' },
    { opcode: 0xE8, name: 'SpecialString', description: 'SpecialString - специальная строка' },
    { opcode: 0xE9, name: 'KeyPacket', description: 'KeyPacket - ключ шифрования' },
    { opcode: 0xEE, name: 'GMHide', description: 'GMHide - скрытие GM' },
    { opcode: 0xF0, name: 'PrivateStoreBuyManageList', description: 'PrivateStoreBuyManageList - управление приватным магазином покупки' },
    { opcode: 0xF3, name: 'PrivateStoreBuyList', description: 'PrivateStoreBuyList - приватный магазин покупки' },
    { opcode: 0xF5, name: 'PrivateStoreBuyMsg', description: 'PrivateStoreBuyMsg - сообщение приватного магазина покупки' },
    { opcode: 0xF9, name: 'ShowXMasSeal2', description: 'ShowXMasSeal - новогодний ивент (альт.)' },
];

// =====================================================================
// Объединённый реестр для совместимости
// =====================================================================
const PACKET_REGISTRY: PacketConfig[] = [...HANDLED_PACKETS, ...PARSED_PACKETS];

/**
 * Настроить фабрику пакетов
 * Регистрирует ВСЕ известные пакеты (с handler и без)
 */
export function configurePacketFactory(factory?: GameIncomingPacketFactory): GameIncomingPacketFactory {
    const packetFactory = factory || new GameIncomingPacketFactory();

    // Раздел 1 + 2: Пакеты с полными классами
    for (const config of PACKET_REGISTRY) {
        packetFactory.register(config.opcode, config.packetClass, {
            name: config.packetClass.name,
            description: config.description,
        });
    }

    // Раздел 3: Generic пакеты (только распознавание по имени)
    for (const def of GENERIC_PACKETS) {
        // Не перезаписываем уже зарегистрированные опкоды
        if (!packetFactory.supports(def.opcode)) {
            const GenericClass = createGenericPacketClass(def.opcode);
            // Переопределяем имя класса для отображения в дашборде
            Object.defineProperty(GenericClass, 'name', { value: def.name });
            packetFactory.register(def.opcode, GenericClass, {
                name: def.name,
                description: def.description,
            });
        }
    }

    return packetFactory;
}

/**
 * Настроить процессор пакетов с обработчиками
 * Регистрирует ТОЛЬКО пакеты с handlers (HANDLED_PACKETS)
 */
export function configurePacketProcessor(
    processor: IPacketProcessor,
    eventBus: IEventBus,
    repositories: {
        character: ICharacterRepository;
        world: IWorldRepository;
        inventory: IInventoryRepository;
    }
): void {
    for (const config of HANDLED_PACKETS) {
        if (config.handlerClass && config.repositories) {
            const repos = config.repositories.map((name) => repositories[name]);
            const handler = new config.handlerClass(eventBus, ...repos);

            // Принудительно устанавливаем opcode из конфига реестра,
            // т.к. некоторые handler'ы хардкодят свой opcode в super(),
            // а реестр может регистрировать их на альтернативном опкоде
            // (напр. MoveToLocation: handler хардкодит 0x2E, но реестр также регистрирует на 0x01)
            Object.defineProperty(handler, 'opcode', {
                value: config.opcode,
                writable: false,
                configurable: true,
            });

            processor.registerHandler(handler);
        }
    }
}

/**
 * Получить список зарегистрированных опкодов (все разделы)
 */
export function getRegisteredOpcodes(): number[] {
    const opcodes = new Set<number>();
    for (const p of PACKET_REGISTRY) opcodes.add(p.opcode);
    for (const p of GENERIC_PACKETS) opcodes.add(p.opcode);
    return Array.from(opcodes).sort((a, b) => a - b);
}

/**
 * Проверить, поддерживается ли опкод
 */
export function isOpcodeSupported(opcode: number): boolean {
    return PACKET_REGISTRY.some((p) => p.opcode === opcode) ||
           GENERIC_PACKETS.some((p) => p.opcode === opcode);
}

/**
 * Получить информацию о пакете по опкоду
 */
export function getPacketInfo(opcode: number): PacketConfig | undefined {
    return PACKET_REGISTRY.find((p) => p.opcode === opcode);
}

/**
 * Получить полный реестр
 */
export function getFullRegistry(): ReadonlyArray<PacketConfig> {
    return Object.freeze([...PACKET_REGISTRY]);
}

/**
 * Получить количество зарегистрированных пакетов (все разделы)
 */
export function getRegisteredPacketCount(): number {
    const opcodes = new Set<number>();
    for (const p of PACKET_REGISTRY) opcodes.add(p.opcode);
    for (const p of GENERIC_PACKETS) opcodes.add(p.opcode);
    return opcodes.size;
}

/**
 * Получить количество обработчиков
 */
export function getHandlerCount(): number {
    return HANDLED_PACKETS.filter((p) => p.handlerClass).length;
}
