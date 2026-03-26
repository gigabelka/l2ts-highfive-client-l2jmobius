import { describe, it, expect, vi } from 'vitest';
import { StateMachineBuilder, createGameStateMachine, createLoginStateMachine } from '../../../src/infrastructure/protocol';

type TestState = 'IDLE' | 'LOADING' | 'READY' | 'ERROR';

describe('StateMachine', () => {
    it('should transition between states', () => {
        const fsm = new StateMachineBuilder<TestState>()
            .setInitialState('IDLE')
            .allowTransition('IDLE', 'LOADING')
            .allowTransition('LOADING', 'READY')
            .build();

        expect(fsm.currentState).toBe('IDLE');

        const result = fsm.transition('LOADING');
        expect(result.isOk()).toBe(true);
        expect(fsm.currentState).toBe('LOADING');
        expect(fsm.previousState).toBe('IDLE');
    });

    it('should reject invalid transitions', () => {
        const fsm = new StateMachineBuilder<TestState>()
            .setInitialState('IDLE')
            .allowTransition('IDLE', 'LOADING')
            .build();

        const result = fsm.transition('READY'); // Not allowed
        expect(result.isErr()).toBe(true);
        expect(fsm.currentState).toBe('IDLE'); // Unchanged
    });

    it('should check if transition is possible', () => {
        const fsm = new StateMachineBuilder<TestState>()
            .setInitialState('IDLE')
            .allowTransition('IDLE', 'LOADING')
            .build();

        expect(fsm.canTransition('LOADING')).toBe(true);
        expect(fsm.canTransition('READY')).toBe(false);
    });

    it('should call enter and exit handlers', () => {
        const onIdleExit = vi.fn();
        const onLoadingEnter = vi.fn();

        const fsm = new StateMachineBuilder<TestState>()
            .setInitialState('IDLE')
            .allowTransition('IDLE', 'LOADING')
            .onExit('IDLE', onIdleExit)
            .onEnter('LOADING', onLoadingEnter)
            .build();

        fsm.transition('LOADING');

        expect(onIdleExit).toHaveBeenCalled();
        expect(onLoadingEnter).toHaveBeenCalled();
    });

    it('should notify transition handlers', () => {
        const onTransition = vi.fn();

        const fsm = new StateMachineBuilder<TestState>()
            .setInitialState('IDLE')
            .allowTransition('IDLE', 'LOADING')
            .build();

        fsm.onTransition(onTransition);
        fsm.transition('LOADING', 'user_click');

        expect(onTransition).toHaveBeenCalledWith(
            expect.objectContaining({
                from: 'IDLE',
                to: 'LOADING',
                trigger: 'user_click',
            })
        );
    });

    it('should track history', () => {
        const fsm = new StateMachineBuilder<TestState>()
            .setInitialState('IDLE')
            .allowTransition('IDLE', ['LOADING', 'ERROR'])
            .allowTransition('LOADING', 'READY')
            .build();

        fsm.transition('LOADING', 'start');
        fsm.transition('READY', 'complete');

        const history = fsm.getHistory();
        expect(history.length).toBe(2);
        expect(history[0].from).toBe('IDLE');
        expect(history[0].to).toBe('LOADING');
        expect(history[0].trigger).toBe('start');
    });

    it('should reset to initial state', () => {
        const fsm = new StateMachineBuilder<TestState>()
            .setInitialState('IDLE')
            .allowTransition('IDLE', 'LOADING')
            .build();

        fsm.transition('LOADING');
        expect(fsm.currentState).toBe('LOADING');

        fsm.reset();
        expect(fsm.currentState).toBe('IDLE');
        expect(fsm.getHistory().length).toBe(0);
    });

    it('should return unsubscribe function', () => {
        const fsm = new StateMachineBuilder<TestState>()
            .setInitialState('IDLE')
            .build();

        const handler = vi.fn();
        const unsubscribe = fsm.onTransition(handler);

        unsubscribe();

        fsm.transition('IDLE'); // Same state transition
        expect(handler).not.toHaveBeenCalled();
    });
});

describe('Game State Machine', () => {
    it('should have correct game states', () => {
        const fsm = createGameStateMachine();
        
        expect(fsm.currentState).toBe('IDLE');
        
        // Test valid transitions
        expect(fsm.canTransition('CONNECTING')).toBe(true);
        
        fsm.transition('CONNECTING');
        expect(fsm.canTransition('WAIT_CRYPT_INIT')).toBe(true);
    });
});

describe('Login State Machine', () => {
    it('should have correct login flow', () => {
        const fsm = createLoginStateMachine();
        
        expect(fsm.currentState).toBe('IDLE');
        
        // Follow login flow
        const flow = ['CONNECTING', 'WAIT_INIT', 'WAIT_GG_AUTH', 'WAIT_LOGIN_OK', 'WAIT_SERVER_LIST', 'WAIT_PLAY_OK'];
        
        for (const state of flow) {
            expect(fsm.canTransition(state)).toBe(true);
            fsm.transition(state);
            expect(fsm.currentState).toBe(state);
        }
        
        // Final state
        expect(fsm.canTransition('DONE')).toBe(true);
    });
});
