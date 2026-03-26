/**
 * @fileoverview StopMoveHandler - обработчик пакета StopMove (0x59)
 * @module infrastructure/protocol/game/handlers
 */

import { BasePacketHandlerStrategy } from '../GamePacketProcessor';
import type { IEventBus, IPacketReader } from '../../../../application/ports';
import type { ICharacterRepository, IWorldRepository } from '../../../../domain/repositories';
import { StopMovePacket } from '../packets/StopMovePacket';
import { NpcInfoUpdatedEvent } from '../../../../domain/events';
import { Position } from '../../../../domain/value-objects';

export class StopMoveHandler extends BasePacketHandlerStrategy<StopMovePacket> {
    constructor(
        protected override readonly eventBus: IEventBus,
        private readonly characterRepo: ICharacterRepository,
        private readonly worldRepo: IWorldRepository
    ) {
        super(0x59, eventBus);
    }

    protected canHandleInState(state: string): boolean {
        // Обрабатываем только в игровом состоянии
        return state === 'IN_GAME';
    }

    handle(_context: { opcode: number; state: string; timestamp: number; rawBody: Buffer }, reader: IPacketReader): void {
        const packet = new StopMovePacket();
        packet.decode(reader);
        const data = packet.getData();

        // Обновляем позицию в репозиториях
        const newPosition = Position.at(data.x, data.y, data.z, data.heading);

        // Пробуем обновить персонажа
        const character = this.characterRepo.get();
        if (character && character.id === data.objectId) {
            character.updatePosition(newPosition);
            this.characterRepo.save(character);
            return;
        }

        // Пробуем обновить NPC/объект в мире
        const npc = this.worldRepo.getNpc(data.objectId);
        if (npc) {
            npc.updatePosition(newPosition);
            this.worldRepo.saveNpc(npc);
            
            // Публикуем событие обновления NPC
            this.eventBus.publish(
                new NpcInfoUpdatedEvent({
                    objectId: data.objectId,
                    position: newPosition,
                })
            );
        }
    }
}
