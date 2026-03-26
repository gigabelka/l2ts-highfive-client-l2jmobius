/**
 * @fileoverview ChangeWaitTypeHandler - обработчик пакета ChangeWaitType (0x2F)
 * @module infrastructure/protocol/game/handlers
 */

import { BasePacketHandlerStrategy } from '../GamePacketProcessor';
import type { IEventBus, IPacketReader } from '../../../../application/ports';
import type { ICharacterRepository, IWorldRepository } from '../../../../domain/repositories';
import { ChangeWaitTypePacket } from '../packets/ChangeWaitTypePacket';
import { CharacterStatsChangedEvent } from '../../../../domain/events';
import { ObjectId } from '../../../../domain/value-objects';

export class ChangeWaitTypeHandler extends BasePacketHandlerStrategy<ChangeWaitTypePacket> {
    constructor(
        protected override readonly eventBus: IEventBus,
        private readonly characterRepo: ICharacterRepository,
        _worldRepo: IWorldRepository
    ) {
        super(0x2F, eventBus);
    }

    protected canHandleInState(state: string): boolean {
        // Обрабатываем только в игровом состоянии
        return state === 'IN_GAME';
    }

    handle(_context: { opcode: number; state: string; timestamp: number; rawBody: Buffer }, reader: IPacketReader): void {
        const packet = new ChangeWaitTypePacket();
        packet.decode(reader);
        const data = packet.getData();

        // Обновляем состояние в репозиториях (только для текущего персонажа)
        const character = this.characterRepo.get();
        if (character && character.id === data.objectId) {
            // Используем update для изменения состояния
            this.characterRepo.update((char) => {
                char.updateStats({});
                return char;
            });
            
            // Публикуем событие изменения статов (состояние сидения передается через GameStateUpdater)
            // GameStateUpdater уже эмитит событие 'me.sit' или 'me.stand'
            this.eventBus.publish(
                new CharacterStatsChangedEvent(
                    {}, // Пустой payload - состояние обновится через GameStateUpdater
                    ObjectId.of(data.objectId)
                )
            );
        }
    }
}
