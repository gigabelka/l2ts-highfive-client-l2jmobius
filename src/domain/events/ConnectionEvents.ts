/**
 * @fileoverview Connection Events - события подключения
 * @module domain/events
 */

import { BaseDomainEvent } from './DomainEvent';

// =============================================================================
// Connection Events
// =============================================================================

export interface ConnectedPayload {
    host: string;
    port: number;
    phase: 'LOGIN' | 'GAME';
}

export class ConnectedEvent extends BaseDomainEvent<ConnectedPayload> {
    readonly type = 'connection.connected';
}

export interface DisconnectedPayload {
    host: string;
    port: number;
    phase: 'LOGIN' | 'GAME';
    reason?: string;
    willReconnect: boolean;
}

export class DisconnectedEvent extends BaseDomainEvent<DisconnectedPayload> {
    readonly type = 'connection.disconnected';
}

export interface AuthenticationSuccessPayload {
    username: string;
    serverId: number;
    sessionId: number;
}

export class AuthenticationSuccessEvent extends BaseDomainEvent<AuthenticationSuccessPayload> {
    readonly type = 'connection.auth_success';
}

export interface AuthenticationFailedPayload {
    username: string;
    reason: string;
    code?: string;
}

export class AuthenticationFailedEvent extends BaseDomainEvent<AuthenticationFailedPayload> {
    readonly type = 'connection.auth_failed';
}

export interface CharacterSelectedPayload {
    slotIndex: number;
    charName: string;
    charId: number;
}

export class CharacterSelectedEvent extends BaseDomainEvent<CharacterSelectedPayload> {
    readonly type = 'connection.character_selected';
}

export interface StateChangedPayload {
    previousState: string;
    newState: string;
    trigger?: string;
}

export class StateChangedEvent extends BaseDomainEvent<StateChangedPayload> {
    readonly type = 'connection.state_changed';
}

export interface ConnectionPhaseChangedPayload {
    phase: string;
    previousPhase?: string;
}

export class ConnectionPhaseChangedEvent extends BaseDomainEvent<ConnectionPhaseChangedPayload> {
    readonly type = 'connection.phase_changed';
}
