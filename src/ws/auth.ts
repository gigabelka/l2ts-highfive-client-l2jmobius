/**
 * @fileoverview Модуль аутентификации WebSocket
 * @module ws/auth
 *
 * Предоставляет функции для валидации и извлечения токенов аутентификации.
 * Использует timing-safe comparison для защиты от timing attacks.
 */

import { timingSafeEqual } from 'crypto';
import type { IncomingMessage } from 'http';
import { parse } from 'url';

/**
 * Создаёт буфер фиксированной длины из строки, дополняя нулями при необходимости
 * @param str - входная строка
 * @param length - целевая длина буфера
 * @returns буфер фиксированной длины
 */
function createFixedBuffer(str: string, length: number): Buffer {
    const buf = Buffer.alloc(length, 0);
    const strBuf = Buffer.from(str, 'utf8');
    strBuf.copy(buf, 0, 0, Math.min(strBuf.length, length));
    return buf;
}

/**
 * Валидирует токен с использованием timing-safe comparison
 * @param token - токен для проверки
 * @param allowedTokens - список разрешённых токенов
 * @returns true если токен валиден
 */
export function validateToken(token: string, allowedTokens: string[]): boolean {
    if (!token || allowedTokens.length === 0) {
        return false;
    }

    // Находим максимальную длину токена для фиксированного сравнения
    const maxLength = Math.max(
        token.length,
        ...allowedTokens.map(t => t.length)
    );

    // Создаём буфер для входного токена
    const tokenBuf = createFixedBuffer(token, maxLength);

    // Сравниваем с каждым разрешённым токеном используя timingSafeEqual
    for (const allowedToken of allowedTokens) {
        const allowedBuf = createFixedBuffer(allowedToken, maxLength);

        try {
            if (timingSafeEqual(tokenBuf, allowedBuf)) {
                return true;
            }
        } catch {
            // Если длины разные (не должно произойти с createFixedBuffer), пропускаем
            continue;
        }
    }

    return false;
}

/**
 * Извлекает токен из HTTP запроса
 * Проверяет query-параметр ?token=xxx и заголовок Authorization: Bearer xxx
 * @param request - HTTP запрос
 * @returns токен или null если не найден
 */
export function extractToken(request: IncomingMessage): string | null {
    // Проверяем query-параметр
    const { query } = parse(request.url || '', true);
    const queryToken = query['token'] as string | undefined;
    if (queryToken) {
        return queryToken;
    }

    // Проверяем заголовок Authorization: Bearer xxx
    const authHeader = request.headers['authorization'];
    if (typeof authHeader === 'string') {
        const parts = authHeader.split(' ');
        if (parts.length === 2 && parts[0]?.toLowerCase() === 'bearer') {
            const bearerToken = parts[1];
            if (bearerToken) {
                return bearerToken;
            }
        }
    }

    return null;
}
