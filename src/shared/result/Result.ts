/**
 * @fileoverview Result<T, E> - функциональный тип для явной обработки ошибок
 * Альтернатива exceptions для контролируемых ошибок
 * @module shared/result
 */

/**
 * Базовый класс для ошибок домена
 */
export abstract class DomainError extends Error {
    abstract readonly code: string;
    abstract readonly isRetryable: boolean;

    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace?.(this, this.constructor);
    }
}

/**
 * Класс Ok - успешный результат
 */
class Ok<T> {
    readonly _tag = 'Ok' as const;
    constructor(readonly value: T) {}

    isOk(): this is Ok<T> {
        return true;
    }

    isErr(): this is never {
        return false;
    }

    map<U>(fn: (value: T) => U): Result<U, never> {
        return Result.ok(fn(this.value));
    }

    mapErr<E>(): Result<T, E> {
        return this as unknown as Result<T, E>;
    }

    flatMap<U, E>(fn: (value: T) => Result<U, E>): Result<U, E> {
        return fn(this.value);
    }

    match<U>(onOk: (value: T) => U, _onErr: unknown): U {
        return onOk(this.value);
    }

    getOrElse(_defaultValue: unknown): T {
        return this.value;
    }

    getOrThrow(): T {
        return this.value;
    }
}

/**
 * Класс Err - ошибка
 */
class Err<E> {
    readonly _tag = 'Err' as const;
    constructor(readonly error: E) {}

    isOk(): this is never {
        return false;
    }

    isErr(): this is Err<E> {
        return true;
    }

    map<U>(): Result<U, E> {
        return this as unknown as Result<U, E>;
    }

    mapErr<F>(fn: (error: E) => F): Result<never, F> {
        return Result.err(fn(this.error));
    }

    flatMap<U, F>(): Result<U, F> {
        return this as unknown as Result<U, F>;
    }

    match<U>(_onOk: unknown, onErr: (error: E) => U): U {
        return onErr(this.error);
    }

    getOrElse<T>(defaultValue: T): T {
        return defaultValue;
    }

    getOrThrow(): never {
        if (this.error instanceof Error) {
            throw this.error;
        }
        throw new Error(String(this.error));
    }
}

/**
 * Тип Result<T, E> - либо Ok<T>, либо Err<E>
 */
export type Result<T, E> = Ok<T> | Err<E>;

/**
 * Фабрика для создания Result
 */
export const Result = {
    ok<T>(value: T): Result<T, never> {
        return new Ok(value);
    },

    err<E>(error: E): Result<never, E> {
        return new Err(error);
    },

    /**
     * Создать Result из функции, которая может бросить исключение
     */
    try<T>(fn: () => T): Result<T, Error> {
        try {
            return new Ok(fn());
        } catch (e) {
            return new Err(e instanceof Error ? e : new Error(String(e)));
        }
    },

    /**
     * Создать Result из Promise
     */
    async tryAsync<T>(promise: Promise<T>): Promise<Result<T, Error>> {
        try {
            const value = await promise;
            return new Ok(value);
        } catch (e) {
            return new Err(e instanceof Error ? e : new Error(String(e)));
        }
    },

    /**
     * Объединить массив Results - если все Ok, вернет Ok с массивом значений,
     * иначе первый Err
     */
    all<T, E>(results: Result<T, E>[]): Result<T[], E> {
        const values: T[] = [];
        for (const result of results) {
            if (result.isErr()) {
                return result as unknown as Result<T[], E>;
            }
            values.push((result as Ok<T>).value);
        }
        return new Ok(values);
    },

    /**
     * Первый успешный результат из массива
     */
    any<T, E>(results: Result<T, E>[]): Result<T, E[]> {
        const errors: E[] = [];
        for (const result of results) {
            if (result.isOk()) {
                return result;
            }
            errors.push((result as Err<E>).error);
        }
        return new Err(errors);
    }
};

/**
 * Тип Option<T> - может быть Some(T) или None
 */
export type Option<T> = Some<T> | None;

class Some<T> {
    readonly _tag = 'Some' as const;
    constructor(readonly value: T) {}

    isSome(): this is Some<T> {
        return true;
    }

    isNone(): this is never {
        return false;
    }

    map<U>(fn: (value: T) => U): Option<U> {
        return new Some(fn(this.value));
    }

    getOrElse(_defaultValue: unknown): T {
        return this.value;
    }
}

class None {
    readonly _tag = 'None' as const;

    isSome(): this is never {
        return false;
    }

    isNone(): this is None {
        return true;
    }

    map<U>(): Option<U> {
        return this as unknown as Option<U>;
    }

    getOrElse<T>(defaultValue: T): T {
        return defaultValue;
    }
}

export const Option = {
    some<T>(value: T): Option<T> {
        return new Some(value);
    },

    none<T>(): Option<T> {
        return new None() as unknown as Option<T>;
    },

    fromNullable<T>(value: T | null | undefined): Option<T> {
        return value == null ? new None() as unknown as Option<T> : new Some(value);
    }
};
