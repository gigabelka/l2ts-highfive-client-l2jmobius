/**
 * @fileoverview CharInfoHandler - стратегия обработки пакета CharInfo (0x03)
 * Обработка информации о других игроках
 * @module infrastructure/protocol/game/handlers
 */

import type { PacketContext, IPacketReader, IEventBus } from '../../../../application/ports';
import type { IWorldRepository } from '../../../../domain/repositories';
import { BasePacketHandlerStrategy } from '../GamePacketProcessor';
import { CharInfoPacket } from '../packets/CharInfoPacket';
import { PlayerSpawnedEvent } from '../../../../domain/events';
import { Position } from '../../../../domain/value-objects';

/**
 * Стратегия обработки пакета CharInfo
 */
export class CharInfoHandler extends BasePacketHandlerStrategy<CharInfoPacket> {
    constructor(
        eventBus: IEventBus,
        _worldRepo: IWorldRepository
    ) {
        super(0x03, eventBus);
    }

    protected canHandleInState(state: string): boolean {
        return state === 'IN_GAME';
    }

    handle(_context: PacketContext, reader: IPacketReader): void {
        const packet = new CharInfoPacket().decode(reader);
        const data = packet.getData();

        // Публикуем событие появления игрока
        this.eventBus.publish(new PlayerSpawnedEvent({
            objectId: data.objectId,
            name: data.name,
            level: data.level,
            classId: data.classId,
            position: Position.at(data.x, data.y, data.z, data.heading),
        }));

        // TODO: Сохранять в WorldRepository когда будет Player entity
    }
}
