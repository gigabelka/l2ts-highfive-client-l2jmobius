/**
 * @fileoverview DomainEvent - базовый класс для всех доменных событий
 * @module domain/events
 */

import type { ObjectId } from '../value-objects';

/**
 * Базовый интерфейс для всех доменных событий
 */
export interface DomainEvent<T = unknown> {
    readonly type: string;
    readonly timestamp: Date;
    readonly channel?: string;
    readonly aggregateId?: ObjectId;
    readonly payload: T;
}

/**
 * Базовый класс для доменных событий
 */
export abstract class BaseDomainEvent<T> implements DomainEvent<T> {
    abstract readonly type: string;
    readonly timestamp: Date;
    readonly aggregateId?: ObjectId;
    readonly payload: T;

    constructor(payload: T, aggregateId?: ObjectId) {
        this.payload = payload;
        this.aggregateId = aggregateId;
        this.timestamp = new Date();
    }

    toJSON() {
        return {
            type: this.type,
            timestamp: this.timestamp.toISOString(),
            aggregateId: this.aggregateId?.value,
            payload: this.payload
        };
    }
}

/**
 * Тип для обработчика событий
 */
export type EventHandler<T> = (event: DomainEvent<T>) => void | Promise<void>;

/**
 * Интерфейс для подписки (для отписки)
 */
export interface Subscription {
    unsubscribe(): void;
}
