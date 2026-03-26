/**
 * @fileoverview IEventBus - порт для шины событий
 * @module application/ports
 */

import type { DomainEvent, EventHandler, Subscription } from '../../domain/events';

/**
 * Порт для шины событий (Event Bus)
 * Позволяет публиковать и подписываться на доменные события
 */
export interface IEventBus {
    /**
     * Опубликовать событие
     */
    publish<T>(event: DomainEvent<T>): void;

    /**
     * Подписаться на событие определенного типа
     */
    subscribe<T>(eventType: string, handler: EventHandler<T>): Subscription;

    /**
     * Подписаться на все события
     */
    subscribeAll(handler: EventHandler<unknown>): Subscription;

    /**
     * Удалить все подписки
     */
    clear(): void;
}

/**
 * Порт для публикации событий (только запись)
 * Полезен для ограничения доступа в определенных контекстах
 */
export interface IEventPublisher {
    publish<T>(event: DomainEvent<T>): void;
}

/**
 * Порт для подписки на события (только чтение)
 */
export interface IEventSubscriber {
    subscribe<T>(eventType: string, handler: EventHandler<T>): Subscription;
    subscribeAll(handler: EventHandler<unknown>): Subscription;
}
