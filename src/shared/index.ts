/**
 * @fileoverview Shared Layer - общие утилиты и типы
 * @module shared
 *
 * @description
 * Shared модуль содержит общие утилиты, типы и базовые классы,
 * которые могут использоваться на всех уровнях приложения.
 */

export { Result, Option, DomainError } from './result';
export type { ResultType, OptionType } from './result';
export * from './types';
export * from './utils';
