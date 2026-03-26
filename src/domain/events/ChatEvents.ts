/**
 * @fileoverview Chat Events - события чата
 * @module domain/events
 */

import { BaseDomainEvent } from './DomainEvent';

export type ChatChannel = 'ALL' | 'SHOUT' | 'TELL' | 'PARTY' | 'CLAN' | 'GAMEMASTER' | 'PETITION_PLAYER' | 'PETITION_GM' | 'TRADE' | 'ALLIANCE' | 'ANNOUNCEMENT' | 'BOT' | 'HERO_VOICE';

export interface ChatMessagePayload {
    senderId?: number;
    senderName: string;
    message: string;
    channel: ChatChannel;
    targetName?: string;
}

export class ChatMessageReceivedEvent extends BaseDomainEvent<ChatMessagePayload> {
    readonly type = 'chat.message_received';
}

export class ChatMessageSentEvent extends BaseDomainEvent<ChatMessagePayload> {
    readonly type = 'chat.message_sent';
}

export interface SystemMessagePayload {
    messageId: number;
    params: string[];
    rawMessage?: string;
}

export class SystemMessageReceivedEvent extends BaseDomainEvent<SystemMessagePayload> {
    readonly type = 'chat.system_message';
}
