/**
 * @fileoverview TeleportToLocationHandler - обработчик пакета TeleportToLocation (0x27)
 * @module infrastructure/protocol/game/handlers
 */

import { BasePacketHandlerStrategy } from '../GamePacketProcessor';
import type { IEventBus, IPacketReader } from '../../../../application/ports';
import type { ICharacterRepository, IWorldRepository } from '../../../../domain/repositories';
import { TeleportToLocationPacket } from '../packets/TeleportToLocationPacket';
import { NpcInfoUpdatedEvent } from '../../../../domain/events';
import { Position } from '../../../../domain/value-objects';

export class TeleportToLocationHandler extends BasePacketHandlerStrategy<TeleportToLocationPacket> {
    constructor(
        protected override readonly eventBus: IEventBus,
        private readonly characterRepo: ICharacterRepository,
        private readonly worldRepo: IWorldRepository
    ) {
        super(0x27, eventBus);
    }

    protected canHandleInState(state: string): boolean {
        // Обрабатываем только в игровом состоянии
        return state === 'IN_GAME' || state === 'WAIT_CHAR_SELECTED';
    }

    handle(_context: { opcode: number; state: string; timestamp: number; rawBody: Buffer }, reader: IPacketReader): void {
        const packet = new TeleportToLocationPacket();
        packet.decode(reader);
        const data = packet.getData();

        const newPosition = Position.at(data.x, data.y, data.z);

        // Пробуем обновить персонажа (только одного, не по objectId)
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
