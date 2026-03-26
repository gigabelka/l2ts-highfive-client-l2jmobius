/**
 * @fileoverview Утилиты для работы со временем
 * @module shared/utils/TimeUtils
 */

import type { Timestamp } from '../types/primitives';

/**
 * Утилиты для работы со временем
 */
export namespace TimeUtils {
  /**
   * Получить текущий timestamp в ms
   */
  export function now(): Timestamp {
    return Date.now();
  }

  /**
   * Получить текущее время в секундах
   */
  export function nowSeconds(): number {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * Форматировать timestamp в ISO строку
   */
  export function toISO(timestamp: Timestamp = Date.now()): string {
    return new Date(timestamp).toISOString();
  }

  /**
   * Форматировать timestamp в локальную строку
   */
  export function toLocalString(timestamp: Timestamp = Date.now()): string {
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
  }

  /**
   * Проверить, прошло ли достаточно времени с последнего события
   */
  export function hasElapsed(lastTime: Timestamp, intervalMs: number): boolean {
    return Date.now() - lastTime >= intervalMs;
  }

  /**
   * Ограничить частоту вызова функции (throttle)
   */
  export function throttle<T extends (...args: unknown[]) => unknown>(
    fn: T,
    intervalMs: number
  ): (...args: Parameters<T>) => ReturnType<T> | undefined {
    let lastTime = 0;
    return (...args: Parameters<T>): ReturnType<T> | undefined => {
      const now = Date.now();
      if (now - lastTime >= intervalMs) {
        lastTime = now;
        return fn(...args) as ReturnType<T>;
      }
      return undefined;
    };
  }

  /**
   * Debounce функции
   */
  export function debounce<T extends (...args: unknown[]) => unknown>(
    fn: T,
    delayMs: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<T>): void => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => fn(...args), delayMs);
    };
  }

  /**
   * Таймаут с Promise
   */
  export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Таймаут с возможностью отмены
   */
  export function createCancellableDelay(ms: number): {
    promise: Promise<void>;
    cancel: () => void;
  } {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let rejectFn: (() => void) | null = null;

    const promise = new Promise<void>((resolve, reject) => {
      rejectFn = reject;
      timeoutId = setTimeout(resolve, ms);
    });

    const cancel = (): void => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        rejectFn?.();
      }
    };

    return { promise, cancel };
  }
}
