/**
 * @fileoverview StateMachine - реализация конечного автомата состояний
 * @module infrastructure/protocol
 */

import { Result } from '../../shared/result';
import type {
    IStateMachine,
    IStateMachineBuilder,
    StateTransitionContext,
    StateTransitionHandler,
} from '../../application/ports';
import { StateMachineError } from '../../application/ports';

/**
 * Реализация конечного автомата состояний
 */
export class StateMachine<TState extends string> implements IStateMachine<TState> {
    private transitions = new Map<TState, Set<TState>>();
    private enterHandlers = new Map<TState, (() => void)[]>();
    private exitHandlers = new Map<TState, (() => void)[]>();
    private transitionHandlers: StateTransitionHandler[] = [];
    private history: StateTransitionContext[] = [];
    private maxHistorySize = 100;

    constructor(
        private initialState: TState,
        public currentState: TState,
        public previousState: TState | undefined = undefined
    ) {}

    /**
     * Регистрировать допустимый переход
     */
    allowTransition(from: TState, to: TState | TState[]): void {
        if (!this.transitions.has(from)) {
            this.transitions.set(from, new Set());
        }

        const targets = Array.isArray(to) ? to : [to];
        const allowed = this.transitions.get(from)!;
        targets.forEach((t) => allowed.add(t));
    }

    /**
     * Зарегистрировать обработчик входа в состояние
     */
    registerEnterHandler(state: TState, handler: () => void): void {
        if (!this.enterHandlers.has(state)) {
            this.enterHandlers.set(state, []);
        }
        this.enterHandlers.get(state)!.push(handler);
    }

    /**
     * Зарегистрировать обработчик выхода из состояния
     */
    registerExitHandler(state: TState, handler: () => void): void {
        if (!this.exitHandlers.has(state)) {
            this.exitHandlers.set(state, []);
        }
        this.exitHandlers.get(state)!.push(handler);
    }

    transition(to: TState, trigger?: string): Result<void, StateMachineError> {
        if (!this.canTransition(to)) {
            return Result.err(new StateMachineError(
                `Cannot transition from ${this.currentState} to ${to}`,
                this.currentState,
                to
            ));
        }

        // Вызываем обработчики выхода
        const exitHandlers = this.exitHandlers.get(this.currentState) || [];
        exitHandlers.forEach((h) => h());

        // Выполняем переход
        this.previousState = this.currentState;
        this.currentState = to;

        // Создаем контекст
        const context: StateTransitionContext = {
            from: this.previousState,
            to,
            trigger,
            timestamp: Date.now(),
        };

        // Добавляем в историю
        this.history.push(context);
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }

        // Вызываем обработчики перехода
        this.transitionHandlers.forEach((handler) => {
            try {
                handler(context);
            } catch (e) {
                console.error('Error in transition handler:', e);
            }
        });

        // Вызываем обработчики входа
        const enterHandlers = this.enterHandlers.get(to) || [];
        enterHandlers.forEach((h) => h());

        return Result.ok(undefined);
    }

    canTransition(to: TState): boolean {
        if (to === this.currentState) return true; // Разрешаем переход в тот же статус

        const allowed = this.transitions.get(this.currentState);
        return allowed ? allowed.has(to) : false;
    }

    isIn(state: TState): boolean {
        return this.currentState === state;
    }

    onTransition(handler: StateTransitionHandler): () => void {
        this.transitionHandlers.push(handler);
        return () => {
            const index = this.transitionHandlers.indexOf(handler);
            if (index !== -1) {
                this.transitionHandlers.splice(index, 1);
            }
        };
    }

    onEnter(state: TState, handler: () => void): () => void {
        this.registerEnterHandler(state, handler);
        return () => {
            const handlers = this.enterHandlers.get(state);
            if (handlers) {
                const index = handlers.indexOf(handler);
                if (index !== -1) {
                    handlers.splice(index, 1);
                }
            }
        };
    }

    onExit(state: TState, handler: () => void): () => void {
        this.registerExitHandler(state, handler);
        return () => {
            const handlers = this.exitHandlers.get(state);
            if (handlers) {
                const index = handlers.indexOf(handler);
                if (index !== -1) {
                    handlers.splice(index, 1);
                }
            }
        };
    }

    reset(): void {
        this.previousState = undefined;
        this.currentState = this.initialState;
        this.history = [];
    }

    getHistory(): StateTransitionContext[] {
        return [...this.history];
    }

    /**
     * Получить граф переходов (для отладки)
     */
    getTransitionGraph(): Record<string, string[]> {
        const graph: Record<string, string[]> = {};
        for (const [from, targets] of this.transitions) {
            graph[from] = Array.from(targets);
        }
        return graph;
    }
}

/**
 * Билдер для State Machine
 */
export class StateMachineBuilder<TState extends string> implements IStateMachineBuilder<TState> {
    private transitions = new Map<TState, Set<TState>>();
    private enterHandlers = new Map<TState, (() => void)[]>();
    private exitHandlers = new Map<TState, (() => void)[]>();
    private initialState!: TState;

    allowTransition(from: TState, to: TState | TState[]): this {
        if (!this.transitions.has(from)) {
            this.transitions.set(from, new Set());
        }

        const targets = Array.isArray(to) ? to : [to];
        const allowed = this.transitions.get(from)!;
        targets.forEach((t) => allowed.add(t));

        return this;
    }

    setInitialState(state: TState): this {
        this.initialState = state;
        return this;
    }

    onEnter(state: TState, handler: () => void): this {
        if (!this.enterHandlers.has(state)) {
            this.enterHandlers.set(state, []);
        }
        this.enterHandlers.get(state)!.push(handler);
        return this;
    }

    onExit(state: TState, handler: () => void): this {
        if (!this.exitHandlers.has(state)) {
            this.exitHandlers.set(state, []);
        }
        this.exitHandlers.get(state)!.push(handler);
        return this;
    }

    build(): StateMachine<TState> {
        if (!this.initialState) {
            throw new Error('Initial state must be set');
        }

        const fsm = new StateMachine<TState>(this.initialState, this.initialState);

        // Копируем переходы
        for (const [from, targets] of this.transitions) {
            targets.forEach((to) => fsm.allowTransition(from, to));
        }

        // Копируем обработчики
        for (const [state, handlers] of this.enterHandlers) {
            handlers.forEach((h) => fsm.registerEnterHandler(state, h));
        }

        for (const [state, handlers] of this.exitHandlers) {
            handlers.forEach((h) => fsm.registerExitHandler(state, h));
        }

        return fsm;
    }
}

/**
 * Создать стандартную FSM для Game Client
 */
export function createGameStateMachine(): StateMachine<
    'IDLE' | 'CONNECTING' | 'WAIT_CRYPT_INIT' | 'WAIT_CHAR_LIST' | 'WAIT_CHAR_SELECTED' | 'WAIT_USER_INFO' | 'IN_GAME' | 'ERROR' | 'DISCONNECTED'
> {
    return new StateMachineBuilder<
        'IDLE' | 'CONNECTING' | 'WAIT_CRYPT_INIT' | 'WAIT_CHAR_LIST' | 'WAIT_CHAR_SELECTED' | 'WAIT_USER_INFO' | 'IN_GAME' | 'ERROR' | 'DISCONNECTED'
    >()
        .setInitialState('IDLE')
        .allowTransition('IDLE', ['CONNECTING', 'ERROR'])
        .allowTransition('CONNECTING', ['WAIT_CRYPT_INIT', 'ERROR', 'DISCONNECTED'])
        .allowTransition('WAIT_CRYPT_INIT', ['WAIT_CHAR_LIST', 'ERROR'])
        .allowTransition('WAIT_CHAR_LIST', ['WAIT_CHAR_SELECTED', 'ERROR'])
        .allowTransition('WAIT_CHAR_SELECTED', ['WAIT_USER_INFO', 'WAIT_CHAR_LIST', 'ERROR'])
        .allowTransition('WAIT_USER_INFO', ['IN_GAME', 'ERROR'])
        .allowTransition('IN_GAME', ['DISCONNECTED', 'ERROR'])
        .allowTransition('ERROR', ['IDLE', 'CONNECTING'])
        .allowTransition('DISCONNECTED', ['IDLE', 'CONNECTING'])
        .build();
}

/**
 * Создать стандартную FSM для Login Client
 */
export function createLoginStateMachine(): StateMachine<
    'IDLE' | 'CONNECTING' | 'WAIT_INIT' | 'WAIT_GG_AUTH' | 'WAIT_LOGIN_OK' | 'WAIT_SERVER_LIST' | 'WAIT_PLAY_OK' | 'DONE' | 'ERROR'
> {
    return new StateMachineBuilder<
        'IDLE' | 'CONNECTING' | 'WAIT_INIT' | 'WAIT_GG_AUTH' | 'WAIT_LOGIN_OK' | 'WAIT_SERVER_LIST' | 'WAIT_PLAY_OK' | 'DONE' | 'ERROR'
    >()
        .setInitialState('IDLE')
        .allowTransition('IDLE', ['CONNECTING', 'ERROR'])
        .allowTransition('CONNECTING', ['WAIT_INIT', 'ERROR'])
        .allowTransition('WAIT_INIT', ['WAIT_GG_AUTH', 'ERROR'])
        .allowTransition('WAIT_GG_AUTH', ['WAIT_LOGIN_OK', 'ERROR'])
        .allowTransition('WAIT_LOGIN_OK', ['WAIT_SERVER_LIST', 'ERROR'])
        .allowTransition('WAIT_SERVER_LIST', ['WAIT_PLAY_OK', 'ERROR'])
        .allowTransition('WAIT_PLAY_OK', ['DONE', 'ERROR'])
        .allowTransition('DONE', ['IDLE'])
        .allowTransition('ERROR', ['IDLE', 'CONNECTING'])
        .build();
}
