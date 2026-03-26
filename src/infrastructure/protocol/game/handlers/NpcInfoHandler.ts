/**
 * @fileoverview NpcInfoHandler - стратегия обработки пакета NpcInfo (0x16)
 * @module infrastructure/protocol/game/handlers
 */

import type { PacketContext, IPacketReader, IEventBus } from '../../../../application/ports';
import type { IWorldRepository } from '../../../../domain/repositories';
import { BasePacketHandlerStrategy } from '../GamePacketProcessor';
import { NpcInfoPacket } from '../packets/NpcInfoPacket';
import { Npc } from '../../../../domain/entities';
import { Position, Vitals } from '../../../../domain/value-objects';


/**
 * Стратегия обработки пакета NpcInfo
 */
export class NpcInfoHandler extends BasePacketHandlerStrategy<NpcInfoPacket> {
    constructor(
        eventBus: IEventBus,
        private worldRepo: IWorldRepository
    ) {
        super(0x16, eventBus);
    }

    protected canHandleInState(state: string): boolean {
        return state === 'IN_GAME';
    }

    handle(_context: PacketContext, reader: IPacketReader): void {
        const packet = new NpcInfoPacket().decode(reader);
        const data = packet.getData();

        // Проверяем, существует ли уже такой NPC
        const existing = this.worldRepo.getNpc(data.objectId);
        if (existing) {
            // Обновляем существующего
            this.worldRepo.updateNpc(data.objectId, (npc) => {
                npc.updatePosition(Position.at(data.x, data.y, data.z));
                return npc;
            });
        } else {
            // Создаем нового NPC
            const vitals = Vitals.create({ 
                current: data.isDead ? 0 : data.maxHp || 100, 
                max: data.maxHp || 100 
            }).getOrElse(Vitals.zero());

            const { npc, event } = Npc.spawn({
                objectId: data.objectId,
                npcId: data.npcId,
                name: data.name,
                level: data.level,
                position: Position.at(data.x, data.y, data.z, data.heading),
                hp: vitals,
                isAttackable: data.attackable,
                isAggressive: false, // Would need additional data
            });

            this.worldRepo.saveNpc(npc);
            this.eventBus.publish(event);
        }
    }
}
