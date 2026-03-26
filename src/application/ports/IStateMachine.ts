/**
 * @fileoverview IStateMachine - порт для конечного автомата состояний
 * @module application/ports
 */

import type { Result } from '../../shared/result';

/**
 * Ошибки состояния
 */
export class StateMachineError extends Error {
    constructor(
        message: string,
        public readonly currentState: string,
        public readonly attemptedTransition?: string
    ) {
        super(message);
        this.name = 'StateMachineError';
    }

    static invalidTransition(from: string, to: string): StateMachineError {
        return new StateMachineError(
            `Cannot transition from ${from} to ${to}`,
            from,
            to
        );
    }

    static invalidState(state: string): StateMachineError {
        return new StateMachineError(`Invalid state: ${state}`, state);
    }
}

/**
 * Контекст перехода состояния
 */
export interface StateTransitionContext {
    from: string;
    to: string;
    trigger?: string;
    timestamp: number;
}

/**
 * Обработчик перехода состояния
 */
export type StateTransitionHandler = (context: StateTransitionContext) => void;

/**
 * Порт для конечного автомата состояний
 */
export interface IStateMachine<TState extends string = string> {
    /**
     * Текущее состояние
     */
    readonly currentState: TState;

    /**
     * Предыдущее состояние
     */
    readonly previousState: TState | undefined;

    /**
     * Перейти в новое состояние
     */
    transition(to: TState, trigger?: string): Result<void, StateMachineError>;

    /**
     * Проверить можно ли перейти в состояние
     */
    canTransition(to: TState): boolean;

    /**
     * Проверить текущее состояние
     */
    isIn(state: TState): boolean;

    /**
     * Подписаться на переходы
     */
    onTransition(handler: StateTransitionHandler): () => void;

    /**
     * Подписаться на вход в конкретное состояние
     */
    onEnter(state: TState, handler: () => void): () => void;

    /**
     * Подписаться на выход из конкретного состояния
     */
    onExit(state: TState, handler: () => void): () => void;

    /**
     * Сбросить в начальное состояние
     */
    reset(): void;

    /**
     * Получить историю переходов
     */
    getHistory(): StateTransitionContext[];
}

/**
 * Определение допустимых переходов
 */
export interface StateTransitionDefinition<TState extends string> {
    from: TState;
    to: TState[];
    onEnter?: () => void;
    onExit?: () => void;
}

/**
 * Билдер для FSM
 */
export interface IStateMachineBuilder<TState extends string> {
    /**
     * Добавить допустимый переход
     */
    allowTransition(from: TState, to: TState | TState[]): this;

    /**
     * Установить начальное состояние
     */
    setInitialState(state: TState): this;

    /**
     * Установить обработчик входа в состояние
     */
    onEnter(state: TState, handler: () => void): this;

    /**
     * Установить обработчик выхода из состояния
     */
    onExit(state: TState, handler: () => void): this;

    /**
     * Построить FSM
     */
    build(): IStateMachine<TState>;
}
