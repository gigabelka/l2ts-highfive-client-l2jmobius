/**
 * @fileoverview Utility types для TypeScript
 * @module shared/types/utility
 */

/** Сделать все свойства обязательными (включая вложенные) */
export type DeepRequired<T> = T extends object
  ? { [K in keyof T]-?: DeepRequired<T[K]> }
  : T;

/** Сделать все свойства опциональными (включая вложенные) */
export type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

/** Только читаемые свойства (включая вложенные) */
export type DeepReadonly<T> = T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;

/** Извлечь типы значений объекта */
export type ValueOf<T> = T[keyof T];

/** Тип для конструктора класса */
export type Constructor<T = object> = new (...args: unknown[]) => T;

/** Тип для абстрактного конструктора */
export type AbstractConstructor<T = object> = abstract new (...args: unknown[]) => T;

/** Функция с любым возвращаемым типом */
export type AnyFunction = (...args: unknown[]) => unknown;

/** Async функция */
export type AsyncFunction<T = unknown> = (...args: unknown[]) => Promise<T>;

/** Не-null и не-undefined тип */
export type NonNullable<T> = Exclude<T, null | undefined>;

/** Тип для обработчика событий */
export type EventHandler<T = void> = (data: T) => void | Promise<void>;

/** Результат валидации */
export type ValidationResult =
  | { readonly success: true }
  | { readonly success: false; readonly error: string };

/** Nullable тип */
export type Nullable<T> = T | null | undefined;

/** Brand тип для типобезопасных ID */
export type Brand<K, T> = K & { readonly __brand: T };

/** Тип для именованных параметров функции */
export type NamedParams<T extends Record<string, unknown>> = T;
