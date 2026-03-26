/**
 * @fileoverview UserInfoHandler - стратегия обработки пакета UserInfo (0x04)
 * Пример использования паттерна Strategy для обработки пакетов
 * @module infrastructure/protocol/game/handlers
 */

import type { PacketContext, IPacketReader } from '../../../../application/ports';
import { BasePacketHandlerStrategy } from '../GamePacketProcessor';
import type { IEventBus } from '../../../../application/ports';
import type { ICharacterRepository } from '../../../../domain/repositories';
import { CharacterEnteredGameEvent, CharacterPositionChangedEvent } from '../../../../domain/events';
import { Character, type CharacterData } from '../../../../domain/entities';
import { ObjectId, Position, Vitals, BaseStats, CombatStats } from '../../../../domain/value-objects';
import { Result } from '../../../../shared/result';
import type { IIncomingPacket } from '../../../../application/ports';

/**
 * DTO для данных UserInfo пакета
 */
export interface UserInfoData {
    objectId: number;
    name: string;
    title?: string;
    level: number;
    exp: number;
    sp: number;
    classId: number;
    raceId: number;
    sex: number;
    x: number;
    y: number;
    z: number;
    vehicleId?: number;
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
    maxCp?: number;
    currentCp?: number;
}

/**
 * Заглушка для IIncomingPacket
 */
class UserInfoPacket implements IIncomingPacket {
    decode(_reader: IPacketReader, _state?: string): this {
        return this;
    }
}

/**
 * Стратегия обработки пакета UserInfo
 * Обновляет состояние персонажа и публикует события
 */
export class UserInfoHandler extends BasePacketHandlerStrategy<UserInfoPacket> {
    constructor(
        eventBus: IEventBus,
        private characterRepo: ICharacterRepository
    ) {
        super(0x04, eventBus); // 0x04 = UserInfo opcode
    }

    protected canHandleInState(state: string): boolean {
        // Обрабатываем в состояниях ожидания входа, выбора персонажа и в игре
        return state === 'WAIT_USER_INFO' || state === 'IN_GAME' || state === 'WAIT_CHAR_SELECTED';
    }

    handle(_context: PacketContext, reader: IPacketReader): void {
        // Декодируем пакет
        const result = this.decodeUserInfo(reader);
        if (result.isErr()) {
            console.error('Failed to decode UserInfo:', result.error);
            return;
        }

        const data = result.getOrThrow();

        // Создаем или обновляем персонажа
        const existing = this.characterRepo.get();
        if (existing) {
            this.updateExistingCharacter(existing, data);
        } else {
            this.createNewCharacter(data);
        }
    }

    /**
     * Декодировать UserInfo из reader
     */
    private decodeUserInfo(reader: IPacketReader): Result<UserInfoData, Error> {
        try {
            // Note: opcode is not in the buffer, it's passed separately via context
            const x = reader.readInt32LE();
            const y = reader.readInt32LE();
            const z = reader.readInt32LE();
            const vehicleId = reader.readInt32LE();
            const objectId = reader.readInt32LE();
            const name = reader.readStringUTF16();
            const raceId = reader.readInt32LE();
            const sex = reader.readInt32LE();
            const classId = reader.readInt32LE();
            const level = reader.readInt32LE();
            const exp = Number(reader.readInt64LE());
            const str = reader.readInt32LE();
            const dex = reader.readInt32LE();
            const con = reader.readInt32LE();
            const int = reader.readInt32LE();
            const wit = reader.readInt32LE();
            const men = reader.readInt32LE();
            const maxHp = reader.readInt32LE();
            const currentHp = reader.readInt32LE();
            const maxMp = reader.readInt32LE();
            const currentMp = reader.readInt32LE();
            const sp = reader.readInt32LE();

            return Result.ok({
                objectId,
                name,
                level,
                exp,
                sp,
                classId,
                raceId,
                sex,
                x,
                y,
                z,
                vehicleId: vehicleId || undefined,
                str,
                dex,
                con,
                int,
                wit,
                men,
                maxHp,
                currentHp,
                maxMp,
                currentMp,
            });
        } catch (error) {
            return Result.err(error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Создать нового персонажа
     */
    private createNewCharacter(data: UserInfoData): void {
        const position = Position.at(data.x, data.y, data.z);
        
        const characterData: CharacterData = {
            objectId: data.objectId,
            name: data.name,
            title: data.title || '',
            level: data.level,
            exp: data.exp,
            sp: data.sp,
            classId: data.classId,
            raceId: data.raceId,
            sex: data.sex,
            position: position,
            hp: Vitals.create({ current: data.currentHp, max: data.maxHp }).getOrElse(Vitals.zero()),
            mp: Vitals.create({ current: data.currentMp, max: data.maxMp }).getOrElse(Vitals.zero()),
            cp: Vitals.create({ current: data.currentCp || 0, max: data.maxCp || 0 }).getOrElse(Vitals.zero()),
            baseStats: BaseStats.create({
                str: data.str,
                dex: data.dex,
                con: data.con,
                int: data.int,
                wit: data.wit,
                men: data.men,
            }),
            combatStats: CombatStats.create({}),
            skills: [],
            activeEffects: [],
            isInCombat: false,
            isDead: data.currentHp <= 0,
        };

        const character = Character.create(characterData);
        this.characterRepo.save(character);

        const objectId = ObjectId.of(data.objectId);

        // Публикуем событие входа в игру
        this.eventBus.publish(
            new CharacterEnteredGameEvent({
                objectId: data.objectId,
                name: data.name,
                level: data.level,
                classId: data.classId,
                raceId: data.raceId,
                sex: data.sex,
                position: position,
            })
        );

        // Публикуем событие изменения позиции
        this.eventBus.publish(
            new CharacterPositionChangedEvent(
                {
                    previousPosition: Position.zero(),
                    newPosition: position,
                    speed: 0,
                    isRunning: true,
                },
                objectId
            )
        );
    }

    /**
     * Обновить существующего персонажа
     */
    private updateExistingCharacter(existing: Character, data: UserInfoData): void {
        // Проверяем изменение позиции
        const oldPosition = existing.position;
        const newPosition = Position.at(data.x, data.y, data.z);

        if (!oldPosition.equals(newPosition)) {
            this.eventBus.publish(
                new CharacterPositionChangedEvent(
                    {
                        previousPosition: oldPosition,
                        newPosition,
                        speed: existing.combatStats.speed || 0,
                        isRunning: true,
                    },
                    ObjectId.of(data.objectId)
                )
            );
        }

        // Обновляем персонажа
        this.characterRepo.update((char) => {
            // Обновляем уровень если изменился
            if (char.level !== data.level) {
                char.setLevel(data.level);
            }
            
            // Обновляем HP/MP если изменились
            if (char.hp.current !== data.currentHp || char.hp.max !== data.maxHp) {
                char.updateHp(data.currentHp, data.maxHp);
            }
            if (char.mp.current !== data.currentMp || char.mp.max !== data.maxMp) {
                char.updateMp(data.currentMp, data.maxMp);
            }

            // Обновляем позицию
            char.updatePosition(newPosition, existing.combatStats.speed || 0, true);

            return char;
        });
    }
}
