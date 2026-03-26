/**
 * @fileoverview SystemEventBus - шина системных событий
 * Для мониторинга, логирования и отладки (не доменные события)
 * @module infrastructure/event-bus
 */

import type { SystemEvent, SystemEventHandler, ISystemEventBus } from './types';
import type { Subscription } from '../../domain/events';

/**
 * Implementation of System Event Bus
 * Синхронная публикация событий для мониторинга
 */
export class SystemEventBus implements ISystemEventBus {
    private handlers = new Map<string, Set<SystemEventHandler<any>>>();

    publish<T extends SystemEvent>(event: T): void {
        const handlers = this.handlers.get(event.type);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(event);
                } catch (error) {
                    console.error(`Error in system event handler for ${event.type}:`, error);
                }
            });
        }
    }

    subscribe<T extends SystemEvent>(eventType: string, handler: SystemEventHandler<T>): Subscription {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, new Set());
        }

        const handlerSet = this.handlers.get(eventType)!;
        const wrappedHandler = handler as SystemEventHandler<any>;
        handlerSet.add(wrappedHandler);

        return {
            unsubscribe: () => {
                handlerSet.delete(wrappedHandler);
                if (handlerSet.size === 0) {
                    this.handlers.delete(eventType);
                }
            },
        };
    }

    clear(): void {
        this.handlers.clear();
    }

    /**
     * Получить статистику подписок
     */
    getStats(): {
        eventTypes: number;
        totalSubscriptions: number;
    } {
        let totalSubscriptions = 0;
        for (const handlers of this.handlers.values()) {
            totalSubscriptions += handlers.size;
        }

        return {
            eventTypes: this.handlers.size,
            totalSubscriptions,
        };
    }
}
