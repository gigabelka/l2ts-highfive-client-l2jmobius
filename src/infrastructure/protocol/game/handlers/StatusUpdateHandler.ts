/**
 * @fileoverview StatusUpdateHandler - обработчик пакета StatusUpdate (0x0E)
 * @module infrastructure/protocol/game/handlers
 */

import type { PacketContext, IPacketReader, IEventBus } from '../../../../application/ports';
import type { ICharacterRepository, IWorldRepository } from '../../../../domain/repositories';
import { BasePacketHandlerStrategy } from '../GamePacketProcessor';
import { StatusUpdatePacket } from '../packets/StatusUpdatePacket';
import { CharacterStatsChangedEvent, NpcInfoUpdatedEvent } from '../../../../domain/events';
import { ObjectId } from '../../../../domain/value-objects';

/**
 * Стратегия обработки пакета StatusUpdate
 * Обновляет HP/MP/CP и другие характеристики
 */
export class StatusUpdateHandler extends BasePacketHandlerStrategy<StatusUpdatePacket> {
    constructor(
        eventBus: IEventBus,
        private characterRepo: ICharacterRepository,
        private worldRepo: IWorldRepository
    ) {
        super(0x0E, eventBus);
    }

    protected canHandleInState(state: string): boolean {
        return state === 'IN_GAME';
    }

    handle(_context: PacketContext, reader: IPacketReader): void {
        const packet = new StatusUpdatePacket().decode(reader);
        const data = packet.getData();

        const character = this.characterRepo.get();
        const isPlayer = character && character.id === data.objectId;

        if (isPlayer) {
            this.handlePlayerUpdate(packet, character.id);
        } else {
            this.handleNpcUpdate(packet);
        }
    }

    private handlePlayerUpdate(packet: StatusUpdatePacket, objectId: number): void {
        const hp = packet.getHp();
        const mp = packet.getMp();
        const cp = packet.getCp();
        const level = packet.getLevel();

        this.characterRepo.update((char) => {
            if (hp) char.updateHp(hp.current, hp.max);
            if (mp) char.updateMp(mp.current, mp.max);
            if (cp) char.updateCp(cp.current, cp.max);
            if (level && level !== char.level) {
                // Level up handling would go here
            }
            return char;
        });

        // Публикуем события изменений
        if (hp) {
            this.eventBus.publish(
                CharacterStatsChangedEvent.createHpChanged(
                    hp.current, hp.max, 0, ObjectId.of(objectId)
                )
            );
        }

        if (mp) {
            this.eventBus.publish(
                CharacterStatsChangedEvent.createMpChanged(
                    mp.current, mp.max, 0, ObjectId.of(objectId)
                )
            );
        }

        if (cp) {
            this.eventBus.publish(
                CharacterStatsChangedEvent.createCpChanged(
                    cp.current, cp.max, 0, ObjectId.of(objectId)
                )
            );
        }
    }

    private handleNpcUpdate(packet: StatusUpdatePacket): void {
        const data = packet.getData();
        const hp = packet.getHp();

        if (hp) {
            this.worldRepo.updateNpc(data.objectId, (npc) => {
                npc.updateHp(hp.current, hp.max);
                return npc;
            });

            this.eventBus.publish(new NpcInfoUpdatedEvent(
                {
                    objectId: data.objectId,
                    currentHp: hp.current,
                    maxHp: hp.max,
                },
            ));
        }
    }
}
