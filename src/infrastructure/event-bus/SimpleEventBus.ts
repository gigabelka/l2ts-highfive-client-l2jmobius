/**
 * @fileoverview SimpleEventBus - простая реализация шины событий
 * @module infrastructure/event-bus
 */

import type {
    DomainEvent,
    EventHandler,
    Subscription,
} from '../../domain/events';
import type { IEventBus } from '../../application/ports';

/**
 * Простая in-memory реализация Event Bus
 * Thread-safe для single-threaded Node.js
 */
export class SimpleEventBus implements IEventBus {
    private handlers = new Map<string, Set<EventHandler<unknown>>>();
    private globalHandlers = new Set<EventHandler<unknown>>();

    publish<T>(event: DomainEvent<T>): void {
        // Глобальные обработчики
        this.globalHandlers.forEach((handler) => {
            try {
                handler(event);
            } catch (error) {
                console.error(`Error in global event handler for ${event.type}:`, error);
            }
        });

        // Специфические обработчики
        const handlers = this.handlers.get(event.type);
        if (handlers) {
            handlers.forEach((handler) => {
                try {
                    handler(event);
                } catch (error) {
                    console.error(`Error in event handler for ${event.type}:`, error);
                }
            });
        }
    }

    subscribe<T>(eventType: string, handler: EventHandler<T>): Subscription {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, new Set());
        }

        const handlerSet = this.handlers.get(eventType)!;
        const wrappedHandler = handler as EventHandler<unknown>;
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

    subscribeAll(handler: EventHandler<unknown>): Subscription {
        this.globalHandlers.add(handler);

        return {
            unsubscribe: () => {
                this.globalHandlers.delete(handler);
            },
        };
    }

    clear(): void {
        this.handlers.clear();
        this.globalHandlers.clear();
    }

    /**
     * Получить статистику подписок
     */
    getStats(): {
        eventTypes: number;
        totalSubscriptions: number;
        globalSubscriptions: number;
    } {
        let totalSubscriptions = 0;
        for (const handlers of this.handlers.values()) {
            totalSubscriptions += handlers.size;
        }

        return {
            eventTypes: this.handlers.size,
            totalSubscriptions,
            globalSubscriptions: this.globalHandlers.size,
        };
    }
}

// Singleton exports удалены - используйте DI контейнер для получения инстансов
// Пример: container.resolve<IEventBus>(DI_TOKENS.EventBus)
