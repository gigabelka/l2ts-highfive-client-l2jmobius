import type { Request, Response, NextFunction } from 'express';
import { API_CONFIG } from '../../config';

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

const rateLimits = new Map<string, RateLimitEntry>();

/**
 * Simple in-memory rate limiter.
 * Cleans up expired entries periodically.
 */
function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = rateLimits.get(key);

    if (!entry || now > entry.resetTime) {
        rateLimits.set(key, {
            count: 1,
            resetTime: now + windowMs
        });
        return true;
    }

    if (entry.count >= maxRequests) {
        return false;
    }

    entry.count++;
    return true;
}

/**
 * General rate limiting middleware (100 req/s default).
 */
export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const clientId = req.ip || 'unknown';
    const key = `general:${clientId}`;

    if (!checkRateLimit(key, API_CONFIG.rateLimit.maxRequests, API_CONFIG.rateLimit.windowMs)) {
        res.status(429).json({
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests'
            },
            meta: { 
                timestamp: new Date().toISOString(),
                retryAfter: Math.ceil(API_CONFIG.rateLimit.windowMs / 1000)
            }
        });
        return;
    }

    next();
}

/**
 * Rate limiter for movement commands (10 req/s).
 */
export function moveRateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const clientId = req.ip || 'unknown';
    const key = `move:${clientId}`;

    if (!checkRateLimit(key, API_CONFIG.rateLimit.moveLimit, API_CONFIG.rateLimit.windowMs)) {
        res.status(429).json({
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Movement commands rate limit exceeded'
            },
            meta: { 
                timestamp: new Date().toISOString(),
                retryAfter: 1
            }
        });
        return;
    }

    next();
}

/**
 * Rate limiter for combat commands (5 req/s).
 */
export function combatRateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const clientId = req.ip || 'unknown';
    const key = `combat:${clientId}`;

    if (!checkRateLimit(key, API_CONFIG.rateLimit.combatLimit, API_CONFIG.rateLimit.windowMs)) {
        res.status(429).json({
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Combat commands rate limit exceeded'
            },
            meta: { 
                timestamp: new Date().toISOString(),
                retryAfter: 1
            }
        });
        return;
    }

    next();
}
