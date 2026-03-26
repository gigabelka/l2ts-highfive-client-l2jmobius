import type { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

/**
 * Generates a unique request ID for tracing.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
    const requestId = randomBytes(8).toString('hex');
    req.requestId = `req_${requestId}`;
    res.setHeader('X-Request-Id', req.requestId);
    next();
}

declare global {
    namespace Express {
        interface Request {
            requestId: string;
        }
    }
}
