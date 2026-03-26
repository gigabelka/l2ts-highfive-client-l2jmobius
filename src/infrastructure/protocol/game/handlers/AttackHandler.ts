/**
 * @fileoverview AttackHandler - обработчик пакета Attack (0x05)
 * @module infrastructure/protocol/game/handlers
 */

import type { PacketContext, IPacketReader, IEventBus } from '../../../../application/ports';
import type { ICharacterRepository } from '../../../../domain/repositories';
import { BasePacketHandlerStrategy } from '../GamePacketProcessor';
import { AttackPacket } from '../packets/AttackPacket';
import { AttackEvent } from '../../../../domain/events';

/**
 * Стратегия обработки пакета Attack
 * Обрабатывает боевые действия
 */
export class AttackHandler extends BasePacketHandlerStrategy<AttackPacket> {
    constructor(
        eventBus: IEventBus,
        private characterRepo: ICharacterRepository
    ) {
        super(0x05, eventBus);
    }

    protected canHandleInState(state: string): boolean {
        return state === 'IN_GAME';
    }

    handle(_context: PacketContext, reader: IPacketReader): void {
        const packet = new AttackPacket().decode(reader);
        const data = packet.getData();

        const character = this.characterRepo.get();
        const isPlayerAttacking = character && character.id === data.attackerId;

        // Публикуем событие атаки
        for (const hit of data.hits) {
            this.eventBus.publish(new AttackEvent({
                attackerId: data.attackerId,
                targetId: hit.targetId,
                damage: packet.isMiss() ? 0 : hit.damage,
                isCritical: packet.isCritical(),
                isMiss: packet.isMiss(),
            }));

            // Если игрок атаковал - обновляем статус боя
            if (isPlayerAttacking) {
                this.characterRepo.update((char) => {
                    char.setInCombat(true);
                    return char;
                });
            }

            // Если цель умерла (damage >= HP)
            if (hit.damage > 0 && !packet.isMiss()) {
                // Note: In real implementation, we'd check if target HP <= 0
                // For now, we just track the attack
            }
        }
    }
}
