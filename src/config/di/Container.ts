/**
 * @fileoverview DI Container - простой Dependency Injection контейнер
 * Регистрация и разрешение зависимостей через типы/токены
 * @module config/di
 */

import type { Result } from '../../shared/result';
import { Result as R } from '../../shared/result';

export type Constructor<T> = new (...args: any[]) => T;
export type Factory<T> = (container: IContainer) => T;

export interface Registration<T> {
    token: symbol;
    factory: Factory<T>;
    singleton: boolean;
    instance?: T;
}

export interface IContainer {
    register<T>(token: symbol, factory: Factory<T>, singleton?: boolean): this;
    registerInstance<T>(token: symbol, instance: T): this;
    registerClass<T>(token: symbol, ctor: Constructor<T>, singleton?: boolean): this;
    resolve<T>(token: symbol): Result<T, DIError>;
    has(token: symbol): boolean;
    createScope(): IContainer;
}

export class DIError extends Error {
    constructor(message: string, public readonly token?: symbol) {
        super(message);
        this.name = 'DIError';
    }

    static notRegistered(token: symbol): DIError {
        return new DIError(`Service not registered: ${token.toString()}`, token);
    }

    static circularDependency(token: symbol): DIError {
        return new DIError(`Circular dependency detected: ${token.toString()}`, token);
    }

    static resolutionFailed(token: symbol, reason: string): DIError {
        return new DIError(`Failed to resolve ${token.toString()}: ${reason}`, token);
    }
}

/**
 * Простой DI Container с поддержкой singleton и scoped lifetimes
 */
export class Container implements IContainer {
    private registrations = new Map<symbol, Registration<unknown>>();
    private parent?: Container;
    private resolutionStack = new Set<symbol>();

    constructor(parent?: Container) {
        this.parent = parent;
    }

    /**
     * Регистрация фабрики
     */
    register<T>(token: symbol, factory: Factory<T>, singleton = false): this {
        this.registrations.set(token, {
            token,
            factory: factory as Factory<unknown>,
            singleton,
        });
        return this;
    }

    /**
     * Регистрация готового instance (singleton)
     */
    registerInstance<T>(token: symbol, instance: T): this {
        this.registrations.set(token, {
            token,
            factory: () => instance,
            singleton: true,
            instance,
        });
        return this;
    }

    /**
     * Регистрация класса
     */
    registerClass<T>(token: symbol, ctor: Constructor<T>, singleton = false): this {
        return this.register(token, (c) => {
            // Простая автоинъекция - пытаемся разрешить параметры конструктора
            // В реальном приложении нужны декораторы для явной маркировки
            return new ctor(c);
        }, singleton);
    }

    /**
     * Разрешение зависимости
     */
    resolve<T>(token: symbol): Result<T, DIError> {
        // Проверка циклических зависимостей
        if (this.resolutionStack.has(token)) {
            return R.err(DIError.circularDependency(token));
        }

        // Ищем в текущем контейнере
        const registration = this.registrations.get(token);
        if (registration) {
            return this.resolveRegistration<T>(registration);
        }

        // Ищем в родительском
        if (this.parent) {
            return this.parent.resolve(token);
        }

        return R.err(DIError.notRegistered(token));
    }

    /**
     * Разрешение registration
     */
    private resolveRegistration<T>(reg: Registration<unknown>): Result<T, DIError> {
        // Возвращаем существующий singleton
        if (reg.singleton && reg.instance !== undefined) {
            return R.ok(reg.instance as T);
        }

        // Создаем новый instance
        this.resolutionStack.add(reg.token);
        try {
            const instance = reg.factory(this) as T;
            
            if (reg.singleton) {
                reg.instance = instance;
            }
            
            return R.ok(instance);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return R.err(DIError.resolutionFailed(reg.token, message));
        } finally {
            this.resolutionStack.delete(reg.token);
        }
    }

    /**
     * Проверить наличие регистрации
     */
    has(token: symbol): boolean {
        return this.registrations.has(token) || (this.parent?.has(token) ?? false);
    }

    /**
     * Создать дочерний scope
     */
    createScope(): IContainer {
        return new Container(this);
    }

    /**
     * Билдер для fluent API
     */
    static builder(): ContainerBuilder {
        return new ContainerBuilder();
    }
}

/**
 * Билдер для контейнера
 */
export class ContainerBuilder {
    private container = new Container();

    register<T>(token: symbol, factory: Factory<T>, singleton = false): this {
        this.container.register(token, factory, singleton);
        return this;
    }

    registerInstance<T>(token: symbol, instance: T): this {
        this.container.registerInstance(token, instance);
        return this;
    }

    registerClass<T>(token: symbol, ctor: Constructor<T>, singleton = false): this {
        this.container.registerClass(token, ctor, singleton);
        return this;
    }

    build(): Container {
        return this.container;
    }
}

// =============================================================================
// DI Tokens - символы для регистрации сервисов
// =============================================================================

export const DI_TOKENS = {
    // Repositories
    CharacterRepository: Symbol('CharacterRepository'),
    WorldRepository: Symbol('WorldRepository'),
    InventoryRepository: Symbol('InventoryRepository'),
    ConnectionRepository: Symbol('ConnectionRepository'),

    // Event Buses
    EventBus: Symbol('EventBus'),           // Domain events
    SystemEventBus: Symbol('SystemEventBus'), // System events для мониторинга

    // Infrastructure
    StateMachine: Symbol('StateMachine'),
    PacketFactory: Symbol('PacketFactory'),
    PacketProcessor: Symbol('PacketProcessor'),
    PacketSerializer: Symbol('PacketSerializer'),

    // Services
    CharacterService: Symbol('CharacterService'),
    CombatService: Symbol('CombatService'),
    GameDataService: Symbol('GameDataService'),

    // Cache
    CacheManager: Symbol('CacheManager'),

    // GameState
    GameState: Symbol('GameState'),
    GameStateUpdater: Symbol('GameStateUpdater'),
    WsApiServer: Symbol('WsApiServer'),
} as const;
