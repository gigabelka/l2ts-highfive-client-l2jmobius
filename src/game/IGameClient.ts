/**
 * @fileoverview IGameClient - Interface for game client
 * Позволяет отвязать GameCommandManager от конкретной реализации GameClient
 * @module game/IGameClient
 */

import type { OutgoingGamePacket } from './packets/outgoing/OutgoingGamePacket';
import type { Result } from '../shared/result';

/**
 * Interface for game client implementations
 * Provides abstraction for sending packets to game server
 */
export interface IGameClient {
    /**
     * Send a packet to the game server
     * @param packet - Outgoing packet to send
     * @returns Result indicating success or failure
     */
    sendPacket(packet: OutgoingGamePacket): Result<void, Error>;
}

/**
 * Factory for creating game client instances
 * Used by DI container
 */
export interface IGameClientFactory {
    /**
     * Create a new game client instance
     */
    create(): IGameClient;
}
