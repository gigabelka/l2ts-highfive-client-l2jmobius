/**
 * @fileoverview Types for System Event Bus
 * System Events are used for monitoring, logging, and debugging
 * @module infrastructure/event-bus
 */

import type { Subscription } from '../../domain/events';

/**
 * System Event - для мониторинга, логирования и отладки
 * Не является частью доменной модели
 */
export interface SystemEvent {
    type: string;
    channel: 'system' | 'network' | 'monitoring';
    payload: unknown;
    timestamp: Date;
}

/**
 * Handler for system events
 */
export interface SystemEventHandler<T extends SystemEvent> {
    (event: T): void;
}

/**
 * Interface for System Event Bus
 * Разделено от Domain Event Bus для четкого разделения ответственности
 */
export interface ISystemEventBus {
    /**
     * Publish a system event
     */
    publish<T extends SystemEvent>(event: T): void;

    /**
     * Subscribe to a specific system event type
     */
    subscribe<T extends SystemEvent>(eventType: string, handler: SystemEventHandler<T>): Subscription;

    /**
     * Clear all subscriptions
     */
    clear(): void;
}
