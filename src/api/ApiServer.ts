import express, { type Application, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { API_CONFIG } from '../config';
import { Logger } from '../logger/Logger';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rateLimiter';
import { requestIdMiddleware } from './middleware/requestId';

// Routes
import statusRouter from './routes/status';
import characterRouter from './routes/character';
import inventoryRouter from './routes/inventory';
import targetRouter from './routes/target';
import nearbyRouter from './routes/nearby';
import combatRouter from './routes/combat';
import movementRouter from './routes/movement';
import skillsRouter from './routes/skills';
import chatRouter from './routes/chat';
import partyRouter from './routes/party';
import connectionRouter from './routes/connection';
import socialRouter from './routes/social';


export class ApiServer {
    private app: Application;
    private server: ReturnType<Application['listen']> | null = null;

    constructor() {
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    private setupMiddleware(): void {
        // Security - CSP configured to allow Scalar CDN
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: [
                        "'self'",
                        "cdn.jsdelivr.net",
                        "unpkg.com",
                        "'unsafe-inline'",
                        "'unsafe-eval'"
                    ],
                    styleSrc: [
                        "'self'",
                        "cdn.jsdelivr.net",
                        "unpkg.com",
                        "'unsafe-inline'"
                    ],
                    connectSrc: [
                        "'self'",
                        "ws://localhost:*",
                        "wss://localhost:*",
                        "ws://*:*",
                        "wss://*:*"
                    ],
                    imgSrc: ["'self'", "data:", "blob:", "https:"],
                    fontSrc: ["'self'", "cdn.jsdelivr.net", "unpkg.com"]
                }
            }
        }));

        // CORS
        if (API_CONFIG.enableCors) {
            this.app.use(cors());
        }

        // Body parsing
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // Request ID for tracing
        this.app.use(requestIdMiddleware);

        // Rate limiting
        this.app.use(rateLimitMiddleware);
    }

    private setupRoutes(): void {
        // Dashboard static files (no auth required)
        const dashboardPath = path.join(__dirname, '..', 'dashboard');
        this.app.use(express.static(dashboardPath, {
            maxAge: process.env['NODE_ENV'] === 'production' ? '1d' : 0
        }));

        // Data files (skills.json, etc.) - no auth required
        const dataPath = path.join(__dirname, '..', '..', 'src', 'data');
        this.app.use('/data', express.static(dataPath, {
            maxAge: process.env['NODE_ENV'] === 'production' ? '1d' : 0
        }));
        
        // Dashboard routes - serve index.html for root and known routes
        this.app.get(['/', '/inventory', '/skills'], (_req: Request, res: Response) => {
            res.sendFile(path.join(dashboardPath, 'index.html'));
        });

        // Health check (no auth required)
        this.app.get('/health', (_req: Request, res: Response) => {
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString()
            });
        });

        // API routes (auth required)
        const apiRouter = express.Router();
        apiRouter.use(authMiddleware);

        // Mount routes
        apiRouter.use('/status', statusRouter);
        apiRouter.use('/character', characterRouter);
        apiRouter.use('/inventory', inventoryRouter);
        apiRouter.use('/target', targetRouter);
        apiRouter.use('/nearby', nearbyRouter);
        apiRouter.use('/combat', combatRouter);
        apiRouter.use('/move', movementRouter);
        apiRouter.use('/skills', skillsRouter);
        apiRouter.use('/chat', chatRouter);
        apiRouter.use('/party', partyRouter);
        apiRouter.use('/', connectionRouter);
        apiRouter.use('/social', socialRouter);

        // Mount API v1
        this.app.use('/api/v1', apiRouter);

        // 404 handler
        this.app.use((req: Request, res: Response) => {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: `Endpoint ${req.method} ${req.path} not found`
                },
                meta: {
                    timestamp: new Date().toISOString()
                }
            });
        });
    }

    private setupErrorHandling(): void {
        this.app.use((err: Error, req: Request, res: Response, _next: unknown) => {
            Logger.error('ApiServer', `Unhandled error: ${err.message}`);
            Logger.error('ApiServer', err.stack || '');

            res.status(500).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Internal server error'
                },
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: (req as Request & { requestId?: string }).requestId
                }
            });
        });
    }

    start(callback?: () => void): void {
        this.server = this.app.listen(API_CONFIG.port, API_CONFIG.host, () => {
            Logger.info('ApiServer', `REST API listening on http://${API_CONFIG.host}:${API_CONFIG.port}`);
            Logger.info('ApiServer', `Dashboard available at http://${API_CONFIG.host}:${API_CONFIG.port}`);
            Logger.info('ApiServer', `API v1 available at http://${API_CONFIG.host}:${API_CONFIG.port}/api/v1`);
            Logger.info('ApiServer', `Health check at http://${API_CONFIG.host}:${API_CONFIG.port}/health`);
            callback?.();
        });
    }

    getServer(): ReturnType<Application['listen']> | null {
        return this.server;
    }

    stop(): void {
        if (this.server) {
            this.server.close(() => {
                Logger.info('ApiServer', 'Server stopped');
            });
        }
    }
}
