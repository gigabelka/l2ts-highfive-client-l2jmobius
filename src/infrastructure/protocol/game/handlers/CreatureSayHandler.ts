/**
 * @fileoverview CreatureSayHandler - обработчик пакета CreatureSay (0x4A)
 * @module infrastructure/protocol/game/handlers
 */

import type { PacketContext, IPacketReader, IEventBus } from '../../../../application/ports';
import type { ICharacterRepository } from '../../../../domain/repositories';
import { BasePacketHandlerStrategy } from '../GamePacketProcessor';
import { CreatureSayPacket, type ChatMessageType } from '../packets/CreatureSayPacket';
import { ChatMessageReceivedEvent } from '../../../../domain/events';

/**
 * Маппинг типов сообщений на каналы
 */
const MESSAGE_TYPE_TO_CHANNEL: Record<ChatMessageType, string> = {
    0x00: 'ALL',
    0x01: 'SHOUT',
    0x02: 'TELL',
    0x03: 'PARTY',
    0x04: 'CLAN',
    0x05: 'GAMEMASTER',
    0x06: 'PETITION_PLAYER',
    0x07: 'PETITION_GM',
    0x08: 'TRADE',
    0x09: 'ALLIANCE',
    0x0A: 'ANNOUNCEMENT',
    0x0B: 'BOT',
    0x0C: 'HERO_VOICE',
};

/**
 * Стратегия обработки пакета CreatureSay
 * Обрабатывает сообщения чата
 */
export class CreatureSayHandler extends BasePacketHandlerStrategy<CreatureSayPacket> {
    constructor(
        eventBus: IEventBus,
        _characterRepo: ICharacterRepository
    ) {
        super(0x4A, eventBus);
    }

    protected canHandleInState(state: string): boolean {
        return state === 'IN_GAME';
    }

    handle(_context: PacketContext, reader: IPacketReader): void {
        const packet = new CreatureSayPacket().decode(reader);
        const data = packet.getData();

        const channel = MESSAGE_TYPE_TO_CHANNEL[data.messageType] || 'ALL';

        const event = new ChatMessageReceivedEvent({
            senderId: data.objectId,
            senderName: data.senderName,
            message: data.message,
            channel: channel as import('../../../../domain/events').ChatChannel,
        });

        this.eventBus.publish(event);
    }
}
