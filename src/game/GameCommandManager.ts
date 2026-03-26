/**
 * @fileoverview GameCommandManager - Рефакторинг с новой архитектурой
 * Предоставляет интерфейс для отправки команд в игру через API
 * @module game/GameCommandManager
 */

import type { IGameClient } from './IGameClient';
import { Logger } from '../logger/Logger';
import type { ICharacterRepository, IWorldRepository } from '../domain/repositories';
import type { IEventBus } from '../application/ports';
import { Position } from '../domain/value-objects';

// Outgoing packets
import { MoveToLocation, AttackRequest, Action, RequestSocialAction, Say2, ChatType, ChangeWaitType2, UseSkill, UseItem, DropItem, RequestJoinParty } from './packets/outgoing';

/**
 * Зависимости для GameCommandManager
 */
export interface GameCommandManagerDeps {
    characterRepo: ICharacterRepository;
    worldRepo: IWorldRepository;
    eventBus: IEventBus;
}

/**
 * GameCommandManager - Singleton для отправки игровых команд из API
 * Использует новую архитектуру (Repositories + EventBus)
 */
export class GameCommandManagerClass {
    private gameClient: IGameClient | null = null;

    constructor(private deps: GameCommandManagerDeps) {}

    /**
     * Регистрация активного GameClient
     */
    setGameClient(client: IGameClient | null): void {
        this.gameClient = client;
        if (client) {
            Logger.info('GameCommandManager', 'GameClient registered');
        } else {
            Logger.info('GameCommandManager', 'GameClient unregistered');
        }
    }

    /**
     * Проверка готовности (в игре)
     */
    isReady(): boolean {
        return this.gameClient !== null && this.deps.characterRepo.exists();
    }

    /**
     * Получить текущую позицию персонажа
     */
    getPosition(): { x: number; y: number; z: number } | null {
        const char = this.deps.characterRepo.get();
        return char ? { x: char.position.x, y: char.position.y, z: char.position.z } : null;
    }

    /**
     * Отправить пакет движения
     */
    moveTo(x: number, y: number, z: number): boolean {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot move: not in game');
            return false;
        }

        const pos = this.getPosition();
        if (!pos) {
            Logger.warn('GameCommandManager', 'Cannot move: position unknown');
            return false;
        }

        try {
            this.gameClient!.sendPacket(new MoveToLocation(x, y, z, pos.x, pos.y, pos.z, 1));
            Logger.info('GameCommandManager', `MoveTo: ${x}, ${y}, ${z}`);

            // Обновляем позицию через репозиторий
            const char = this.deps.characterRepo.get();

            if (char) {
                this.deps.characterRepo.update((c) => {
                    const newPos = Position.create({ x, y, z, heading: c.position.heading });
                    if (newPos.isOk()) {
                        c.updatePosition(
                            newPos.getOrThrow(),
                            c.combatStats.speed || 0,
                            true
                        );
                    }
                    return c;
                });

                // Публикуем событие
                this.deps.eventBus.publish({
                    type: 'movement.position_changed',
                    channel: 'movement',
                    payload: {
                        objectId: char.id,
                        position: { x, y, z },
                        speed: char.combatStats.speed || 0,
                        isRunning: true
                    },
                    timestamp: new Date(),
                });
            }

            return true;
        } catch (error) {
            Logger.error('GameCommandManager', `Move failed: ${error}`);
            return false;
        }
    }

    /**
     * Отправить пакет атаки
     */
    attack(objectId: number, shiftClick: boolean = false): boolean {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot attack: not in game');
            return false;
        }

        const pos = this.getPosition();
        if (!pos) {
            Logger.warn('GameCommandManager', 'Cannot attack: position unknown');
            return false;
        }

        try {
            this.gameClient!.sendPacket(new AttackRequest(objectId, pos.x, pos.y, pos.z, shiftClick));
            Logger.info('GameCommandManager', `Attack: ${objectId}, shift=${shiftClick}`);

            // Обновляем боевое состояние
            const char = this.deps.characterRepo.get();

            if (char) {
                char.setInCombat(true);

                this.deps.eventBus.publish({
                    type: 'combat.attack_sent',
                    channel: 'combat',
                    payload: {
                        attackerObjectId: char.id,
                        targetObjectId: objectId,
                        damage: 0,
                        isCritical: false,
                        isMiss: false,
                        attackType: 'MELEE'
                    },
                    timestamp: new Date(),
                });
            }

            return true;
        } catch (error) {
            Logger.error('GameCommandManager', `Attack failed: ${error}`);
            return false;
        }
    }

    /**
     * Отправить Action пакет (для таргета)
     */
    action(objectId: number, shiftClick: boolean = false): boolean {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot action: not in game');
            return false;
        }

        const pos = this.getPosition();
        if (!pos) {
            Logger.warn('GameCommandManager', 'Cannot action: position unknown');
            return false;
        }

        try {
            this.gameClient!.sendPacket(new Action(objectId, pos.x, pos.y, pos.z, shiftClick));
            Logger.info('GameCommandManager', `Action: ${objectId}, shift=${shiftClick}`);
            return true;
        } catch (error) {
            Logger.error('GameCommandManager', `Action failed: ${error}`);
            return false;
        }
    }

    /**
     * Отправить социальное действие
     */
    socialAction(actionId: number): boolean {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot social action: not in game');
            return false;
        }

        try {
            this.gameClient!.sendPacket(new RequestSocialAction(actionId));
            Logger.info('GameCommandManager', `SocialAction: ${actionId}`);
            return true;
        } catch (error) {
            Logger.error('GameCommandManager', `Social action failed: ${error}`);
            return false;
        }
    }

    /**
     * Переключить сид/стоять
     */
    toggleSit(stand: boolean = false): boolean {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot toggle sit: not in game');
            return false;
        }

        try {
            this.gameClient!.sendPacket(new ChangeWaitType2(stand));
            Logger.info('GameCommandManager', `ChangeWaitType2: ${stand ? 'Stand' : 'Sit'}`);
            return true;
        } catch (error) {
            Logger.error('GameCommandManager', `Toggle sit failed: ${error}`);
            return false;
        }
    }

    /**
     * Отправить сообщение в чат
     */
    sendChat(message: string, chatType: ChatType = ChatType.ALL, target: string = ''): boolean {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot send chat: not in game');
            return false;
        }

        try {
            this.gameClient!.sendPacket(new Say2(message, chatType, target));
            Logger.info('GameCommandManager', `Chat [${chatType}]: ${message.substring(0, 50)}`);

            // Публикуем событие
            const char = this.deps.characterRepo.get();

            if (char) {
                this.deps.eventBus.publish({
                    type: 'chat.message',
                    channel: 'chat',
                    payload: {
                        channel: ChatType[chatType],
                        message,
                        senderName: char.name,
                        senderObjectId: char.id,
                        receivedAt: new Date().toISOString()
                    },
                    timestamp: new Date(),
                });
            }

            return true;
        } catch (error) {
            Logger.error('GameCommandManager', `Chat failed: ${error}`);
            return false;
        }
    }

    /**
     * Поднять предмет с земли
     */
    async pickupItem(objectId: number): Promise<boolean> {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot pickup: not in game');
            return false;
        }

        // Ищем предмет в мире
        const item = this.deps.worldRepo.getItem(objectId);

        if (!item) {
            Logger.warn('GameCommandManager', `Item ${objectId} not found`);
            return false;
        }

        // Проверяем расстояние до предмета
        const char = this.deps.characterRepo.get();
        if (!char) {
            Logger.warn('GameCommandManager', 'Cannot pickup: character not found');
            return false;
        }

        const distance = char.position.distanceTo(item.position);
        if (distance > 150) {
            Logger.warn('GameCommandManager', `Item ${objectId} is too far (${distance.toFixed(1)}m), move closer first`);
            return false;
        }

        // Отправляем Action пакет для поднятия (как в обычном клиенте)
        const success = this.action(objectId, false);
        
        if (success) {
            Logger.info('GameCommandManager', `Pickup item: ${item.name} (${objectId})`);

            // Публикуем событие
            this.deps.eventBus.publish({
                type: 'world.item_picking_up',
                channel: 'world',
                payload: {
                    objectId: item.id,
                    itemId: item.itemId,
                    name: item.name,
                    count: item.count
                },
                timestamp: new Date(),
            });
        }

        return success;
    }

    /**
     * Поднять ближайший предмет
     */
    async pickupNearestItem(radius: number = 200): Promise<boolean> {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot pickup: not in game');
            return false;
        }

        const char = this.deps.characterRepo.get();

        if (!char) return false;

        const items = this.deps.worldRepo.getNearbyItems(char.position, radius);

        if (items.length === 0) {
            Logger.info('GameCommandManager', 'No items nearby to pickup');
            return false;
        }

        // Берем ближайший
        return this.pickupItem(items[0]!.id);
    }

    /**
     * Использовать скилл
     */
    useSkill(skillId: number, ctrlPressed: boolean = false, shiftPressed: boolean = false): boolean {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot use skill: not in game');
            return false;
        }

        try {
            this.gameClient!.sendPacket(new UseSkill(skillId, ctrlPressed, shiftPressed));
            Logger.info('GameCommandManager', `UseSkill: ${skillId}, ctrl=${ctrlPressed}, shift=${shiftPressed}`);
            return true;
        } catch (error) {
            Logger.error('GameCommandManager', `Use skill failed: ${error}`);
            return false;
        }
    }

    /**
     * Использовать предмет
     */
    useItem(objectId: number): boolean {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot use item: not in game');
            return false;
        }

        try {
            this.gameClient!.sendPacket(new UseItem(objectId));
            Logger.info('GameCommandManager', `UseItem: ${objectId}`);
            return true;
        } catch (error) {
            Logger.error('GameCommandManager', `Use item failed: ${error}`);
            return false;
        }
    }

    /**
     * Выбросить предмет
     */
    dropItem(objectId: number, count: number, x?: number, y?: number, z?: number): boolean {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot drop item: not in game');
            return false;
        }

        // Используем текущую позицию если координаты не указаны
        let dropX = x;
        let dropY = y;
        let dropZ = z;

        if (dropX === undefined || dropY === undefined || dropZ === undefined) {
            const pos = this.getPosition();
            if (!pos) {
                Logger.warn('GameCommandManager', 'Cannot drop item: position unknown');
                return false;
            }
            dropX = pos.x;
            dropY = pos.y;
            dropZ = pos.z;
        }

        try {
            this.gameClient!.sendPacket(new DropItem(objectId, count, dropX, dropY, dropZ));
            Logger.info('GameCommandManager', `DropItem: ${objectId} x${count} at ${dropX},${dropY},${dropZ}`);
            return true;
        } catch (error) {
            Logger.error('GameCommandManager', `Drop item failed: ${error}`);
            return false;
        }
    }

    /**
     * Пригласить в пати
     */
    inviteToParty(playerName: string): boolean {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot invite to party: not in game');
            return false;
        }

        try {
            this.gameClient!.sendPacket(new RequestJoinParty(playerName));
            Logger.info('GameCommandManager', `InviteToParty: ${playerName}`);
            return true;
        } catch (error) {
            Logger.error('GameCommandManager', `Invite to party failed: ${error}`);
            return false;
        }
    }

    /**
     * Покинуть пати
     */
    leaveParty(): boolean {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot leave party: not in game');
            return false;
        }

        try {
            // Отправляем команду через чат
            this.gameClient!.sendPacket(new Say2('/leaveparty', ChatType.ALL, ''));
            Logger.info('GameCommandManager', 'LeaveParty command sent');
            return true;
        } catch (error) {
            Logger.error('GameCommandManager', `Leave party failed: ${error}`);
            return false;
        }
    }

    /**
     * Остановить движение
     */
    stopMove(): boolean {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot stop move: not in game');
            return false;
        }

        const pos = this.getPosition();
        if (!pos) {
            Logger.warn('GameCommandManager', 'Cannot stop move: position unknown');
            return false;
        }

        try {
            Logger.info('GameCommandManager', `StopMove at ${pos.x},${pos.y},${pos.z}`);
            return true;
        } catch (error) {
            Logger.error('GameCommandManager', `Stop move failed: ${error}`);
            return false;
        }
    }

    /**
     * Следовать за целью
     */
    follow(objectId: number, minDistance: number = 100): boolean {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot follow: not in game');
            return false;
        }

        const npc = this.deps.worldRepo.getNpc(objectId);
        // TODO: Add player lookup when player repository is implemented
        const target = npc;

        if (!target) {
            Logger.warn('GameCommandManager', `Cannot follow: target ${objectId} not found`);
            return false;
        }

        // Устанавливаем таргет
        this.deps.characterRepo.update((char) => {
            char.setTarget(objectId);
            return char;
        });

        Logger.info('GameCommandManager', `Follow ${target.name} (${objectId}) with minDistance=${minDistance}`);
        return true;
    }
}

// Глобальный инстанс — будет инициализирован в index.ts
export let GameCommandManager: GameCommandManagerClass;

/**
 * Инициализировать GameCommandManager с зависимостями
 * Должен вызываться один раз при старте приложения (в index.ts)
 */
export function initGameCommandManager(deps: GameCommandManagerDeps): GameCommandManagerClass {
    GameCommandManager = new GameCommandManagerClass(deps);
    return GameCommandManager;
}

/**
 * Сбросить инстанс (для тестов)
 */
export function resetGameCommandManager(): void {
    GameCommandManager = undefined as unknown as GameCommandManagerClass;
}
