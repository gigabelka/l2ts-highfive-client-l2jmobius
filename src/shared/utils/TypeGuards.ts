/**
 * @fileoverview Type guards для runtime проверок
 * @module shared/utils/TypeGuards
 */

import type { Result } from '../result';

/**
 * Type guards для безопасных проверок типов
 */
export namespace TypeGuards {
  /**
   * Проверить, что значение - не-null объект
   */
  export function isNonNullObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  /**
   * Проверить, что значение - функция
   */
  export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
    return typeof value === 'function';
  }

  /**
   * Проверить, что значение - строка
   */
  export function isString(value: unknown): value is string {
    return typeof value === 'string';
  }

  /**
   * Проверить, что значение - число (и не NaN)
   */
  export function isNumber(value: unknown): value is number {
    return typeof value === 'number' && !Number.isNaN(value);
  }

  /**
   * Проверить, что значение - целое число
   */
  export function isInteger(value: unknown): value is number {
    return isNumber(value) && Number.isInteger(value);
  }

  /**
   * Проверить, что значение - Buffer
   */
  export function isBuffer(value: unknown): value is Buffer {
    return Buffer.isBuffer(value);
  }

  /**
   * Проверить, что значение - Error
   */
  export function isError(value: unknown): value is Error {
    return value instanceof Error;
  }

  /**
   * Проверить, что значение - Promise
   */
  export function isPromise<T = unknown>(value: unknown): value is Promise<T> {
    return (
      isNonNullObject(value) &&
      'then' in value &&
      typeof value['then'] === 'function'
    );
  }

  /**
   * Проверить, что массив не пустой
   */
  export function isNonEmptyArray<T>(value: T[]): value is [T, ...T[]] {
    return Array.isArray(value) && value.length > 0;
  }

  /**
   * Проверить, что значение имеет определенный метод
   */
  export function hasMethod<K extends string>(
    value: unknown,
    method: K
  ): value is Record<K, (...args: unknown[]) => unknown> {
    return (
      isNonNullObject(value) &&
      method in value &&
      typeof value[method] === 'function'
    );
  }

  /**
   * Проверить, что объект имеет свойство
   */
  export function hasProperty<K extends string>(
    value: unknown,
    prop: K
  ): value is Record<K, unknown> {
    return isNonNullObject(value) && prop in value;
  }

  /**
   * Проверить, что значение - Result
   */
  export function isResult<T, E>(value: unknown): value is Result<T, E> {
    return (
      isNonNullObject(value) &&
      ('_tag' in value) &&
      (value['_tag'] === 'Ok' || value['_tag'] === 'Err')
    );
  }

  /**
   * Проверить, что значение - Ok Result
   */
  export function isOkResult<T>(value: unknown): value is { _tag: 'Ok'; value: T } {
    return isResult(value) && value._tag === 'Ok';
  }

  /**
   * Проверить, что значение - Err Result
   */
  export function isErrResult<E>(value: unknown): value is { _tag: 'Err'; error: E } {
    return isResult(value) && value._tag === 'Err';
  }
}
