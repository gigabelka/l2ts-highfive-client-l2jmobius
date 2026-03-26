import { describe, it, expect, vi } from 'vitest';
import { SimpleEventBus } from '../../../src/infrastructure/event-bus';
import { BaseDomainEvent } from '../../../src/domain/events';

// Test event
class TestEvent extends BaseDomainEvent<{ value: number }> {
    readonly type = 'test.event';
}

class OtherEvent extends BaseDomainEvent<{ message: string }> {
    readonly type = 'other.event';
}

describe('SimpleEventBus', () => {
    it('should publish and receive events', () => {
        const bus = new SimpleEventBus();
        const handler = vi.fn();

        bus.subscribe('test.event', handler);
        bus.publish(new TestEvent({ value: 42 }));

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'test.event',
                payload: { value: 42 },
            })
        );
    });

    it('should unsubscribe from events', () => {
        const bus = new SimpleEventBus();
        const handler = vi.fn();

        const subscription = bus.subscribe('test.event', handler);
        subscription.unsubscribe();

        bus.publish(new TestEvent({ value: 42 }));
        expect(handler).not.toHaveBeenCalled();
    });

    it('should handle multiple subscribers', () => {
        const bus = new SimpleEventBus();
        const handler1 = vi.fn();
        const handler2 = vi.fn();

        bus.subscribe('test.event', handler1);
        bus.subscribe('test.event', handler2);

        bus.publish(new TestEvent({ value: 42 }));

        expect(handler1).toHaveBeenCalledTimes(1);
        expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should handle global subscription', () => {
        const bus = new SimpleEventBus();
        const handler = vi.fn();

        bus.subscribeAll(handler);

        bus.publish(new TestEvent({ value: 1 }));
        bus.publish(new OtherEvent({ message: 'test' }));

        expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should handle errors in handlers gracefully', () => {
        const bus = new SimpleEventBus();
        const errorHandler = vi.fn(() => { throw new Error('Test error'); });
        const normalHandler = vi.fn();

        bus.subscribe('test.event', errorHandler);
        bus.subscribe('test.event', normalHandler);

        // Should not throw
        expect(() => bus.publish(new TestEvent({ value: 42 }))).not.toThrow();

        // Both handlers should be called despite error
        expect(errorHandler).toHaveBeenCalled();
        expect(normalHandler).toHaveBeenCalled();
    });

    it('should provide stats', () => {
        const bus = new SimpleEventBus();

        bus.subscribe('event1', () => {});
        bus.subscribe('event1', () => {});
        bus.subscribe('event2', () => {});
        bus.subscribeAll(() => {});

        const stats = bus.getStats();
        expect(stats.eventTypes).toBe(2);
        expect(stats.totalSubscriptions).toBe(3);
        expect(stats.globalSubscriptions).toBe(1);
    });

    it('should clear all subscriptions', () => {
        const bus = new SimpleEventBus();
        const handler = vi.fn();

        bus.subscribe('test.event', handler);
        bus.subscribeAll(handler);

        bus.clear();

        bus.publish(new TestEvent({ value: 42 }));
        expect(handler).not.toHaveBeenCalled();
    });
});
