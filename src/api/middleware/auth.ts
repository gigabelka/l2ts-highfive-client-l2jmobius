import type { Request, Response, NextFunction } from 'express';
// import { API_CONFIG } from '../../config';  // Temporarily disabled

export interface AuthenticatedRequest extends Request {
    apiKey?: string;
}

/**
 * API Key authentication middleware.
 * If API_CONFIG.apiKey is empty, authentication is disabled.
 */
export function authMiddleware(_req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
    // API_KEY authentication temporarily disabled
    next();
    return;

    /* Original authentication code - temporarily disabled
    // If no apiKey configured, skip authentication
    if (!API_CONFIG.apiKey) {
        next();
        return;
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Missing Authorization header'
            },
            meta: { timestamp: new Date().toISOString() }
        });
        return;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0]!.toLowerCase() !== 'bearer') {
        res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid Authorization format. Use: Bearer <token>'
            },
            meta: { timestamp: new Date().toISOString() }
        });
        return;
    }

    const token = parts[1];
    
    if (token !== API_CONFIG.apiKey) {
        res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid API key'
            },
            meta: { timestamp: new Date().toISOString() }
        });
        return;
    }

    req.apiKey = token;
    next();
    */
}
