import { Router, type Request, type Response } from 'express';
import { getContainer } from '../../config/di/appContainer';
import { DI_TOKENS } from '../../config/di/Container';
import type { IConnectionRepository } from '../../domain/repositories';
import { ConnectionPhase } from '../../domain/repositories/IConnectionRepository';

const router = Router();

// Repository accessors
const container = getContainer();
const getConnectionRepo = () => container.resolve<IConnectionRepository>(DI_TOKENS.ConnectionRepository).getOrThrow();

/**
 * GET /api/v1/status
 * Returns current connection status and client phase.
 */
router.get('/', (req: Request, res: Response) => {
    const connectionState = getConnectionRepo().get();
    
    // Determine connection state for specific servers
    const isLoginPhase = [
        ConnectionPhase.LOGIN_CONNECTING,
        ConnectionPhase.LOGIN_AUTHENTICATING,
        ConnectionPhase.WAITING_SERVER_SELECT
    ].includes(connectionState.phase);
    
    const isGamePhase = [
        ConnectionPhase.SELECTING_CHARACTER,
        ConnectionPhase.ENTERING_GAME,
        ConnectionPhase.IN_GAME
    ].includes(connectionState.phase);

    res.json({
        success: true,
        data: {
            phase: connectionState.phase,
            loginServer: { 
                connected: isLoginPhase || isGamePhase, 
                host: isLoginPhase ? connectionState.host : '', 
                port: isLoginPhase ? connectionState.port : 0 
            },
            gameServer: { 
                connected: isGamePhase, 
                host: isGamePhase ? connectionState.host : '', 
                port: isGamePhase ? connectionState.port : 0 
            },
            uptime: connectionState.uptime,
            pingMs: undefined,
            error: connectionState.error
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

export default router;
