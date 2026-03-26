/**
 * @fileoverview GameState - единое in-memory хранилище всего, что видит персонаж
 * @module game/GameState
 *
 * Ядро модели мира. Хранит всю информацию о текущем состоянии игры:
 * - Данные персонажа (me)
 * - Другие игроки, NPC, предметы
 * - Инвентарь, скиллы, группа
 * - Чат, эффекты, цель
 *
 * Наследуется от EventEmitter для оповещения об изменениях.
 */

import { EventEmitter } from 'events';
import {
    CharacterMe,
    Player,
    Npc,
    DroppedItem,
    InventoryItem,
    Skill,
    PartyMember,
    ChatMessage,
    ActiveEffect,
    TargetInfo,
} from './entities/types';

/**
 * Единое in-memory хранилище всего, что видит персонаж
 * @extends EventEmitter
 */
export class GameState extends EventEmitter {
    /** Мой персонаж (полная информация из UserInfo) */
    public me: CharacterMe | null = null;

    /** Другие игроки в мире (objectId → Player) */
    public players: Map<number, Player> = new Map();

    /** NPC и мобы в мире (objectId → Npc) */
    public npcs: Map<number, Npc> = new Map();

    /** Предметы на земле (objectId → DroppedItem) */
    public items: Map<number, DroppedItem> = new Map();

    /** Инвентарь персонажа (objectId → InventoryItem) */
    public inventory: Map<number, InventoryItem> = new Map();

    /** Список скиллов персонажа */
    public skills: Skill[] = [];

    /** Члены группы (пати) */
    public party: PartyMember[] = [];

    /** История сообщений чата */
    public chat: ChatMessage[] = [];

    /** Активные эффекты (баффы/дебаффы) */
    public effects: ActiveEffect[] = [];

    /** Текущая цель */
    public target: TargetInfo | null = null;

    /** Серверное время (для синхронизации) */
    public serverTime: number = 0;

    /**
     * Эмитит событие для WebSocket с обёрткой WsEvent
     * @param eventName - название события
     * @param data - данные события
     */
    public update(eventName: string, data: unknown): void {
        this.emit('ws:event', {
            type: eventName,
            ts: Date.now(),
            data,
        });
    }

    /**
     * Возвращает полный снимок текущего состояния мира
     * @returns Объект с полным состоянием игры
     */
    public getSnapshot(): object {
        return {
            me: this.me,
            players: Array.from(this.players.values()),
            npcs: Array.from(this.npcs.values()),
            items: Array.from(this.items.values()),
            inventory: Array.from(this.inventory.values()),
            skills: this.skills,
            party: this.party,
            chat: this.chat.slice(-50), // Последние 50 сообщений
            effects: this.effects,
            target: this.target,
            serverTime: this.serverTime,
        };
    }

    /**
     * Очищает все коллекции (используется при реконнекте)
     */
    public reset(): void {
        this.me = null;
        this.players.clear();
        this.npcs.clear();
        this.items.clear();
        this.inventory.clear();
        this.skills = [];
        this.party = [];
        this.chat = [];
        this.effects = [];
        this.target = null;
        this.serverTime = 0;
    }

    /**
     * Считает 2D расстояние от персонажа до указанной точки
     * @param x - координата X
     * @param y - координата Y
     * @returns Расстояние в игровых единицах или 0 если персонаж не инициализирован
     */
    public calcDistance(x: number, y: number): number {
        if (this.me === null) {
            return 0;
        }

        const dx = this.me.x - x;
        const dy = this.me.y - y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}
