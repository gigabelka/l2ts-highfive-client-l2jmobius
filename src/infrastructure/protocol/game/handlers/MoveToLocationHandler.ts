/**
 * @fileoverview MoveToLocationHandler - обработчик пакета MoveToLocation (0x2E)
 * @module infrastructure/protocol/game/handlers
 */

import type { PacketContext, IPacketReader, IEventBus } from '../../../../application/ports';
import type { ICharacterRepository, IWorldRepository } from '../../../../domain/repositories';
import { BasePacketHandlerStrategy } from '../GamePacketProcessor';
import { MoveToLocationPacket } from '../packets/MoveToLocationPacket';
import { CharacterPositionChangedEvent, NpcInfoUpdatedEvent } from '../../../../domain/events';
import { Position } from '../../../../domain/value-objects';
import { ObjectId } from '../../../../domain/value-objects';

/**
 * Стратегия обработки пакета MoveToLocation
 * Обновляет позицию сущностей
 */
export class MoveToLocationHandler extends BasePacketHandlerStrategy<MoveToLocationPacket> {
    constructor(
        eventBus: IEventBus,
        private characterRepo: ICharacterRepository,
        private worldRepo: IWorldRepository
    ) {
        super(0x2E, eventBus);
    }

    protected canHandleInState(state: string): boolean {
        return state === 'IN_GAME';
    }

    handle(_context: PacketContext, reader: IPacketReader): void {
        const packet = new MoveToLocationPacket().decode(reader);
        const data = packet.getData();

        const character = this.characterRepo.get();
        
        if (character && character.id === data.objectId) {
            // Это движение игрока
            const newPosition = Position.at(data.targetX, data.targetY, data.targetZ);
            
            this.characterRepo.update((char) => {
                char.updatePosition(newPosition, data.moveSpeed, true);
                return char;
            });

            this.eventBus.publish(new CharacterPositionChangedEvent(
                {
                    previousPosition: character.position,
                    newPosition,
                    speed: data.moveSpeed,
                    isRunning: true,
                },
                ObjectId.of(character.id)
            ));
        } else {
            // Это движение NPC или другого игрока
            const npc = this.worldRepo.getNpc(data.objectId);
            if (npc) {
                this.worldRepo.updateNpc(data.objectId, (n) => {
                    n.updatePosition(Position.at(data.targetX, data.targetY, data.targetZ));
                    return n;
                });

                this.eventBus.publish(new NpcInfoUpdatedEvent(
                    {
                        objectId: data.objectId,
                        position: Position.at(data.targetX, data.targetY, data.targetZ),
                    },
                ));
            }
        }
    }
}
