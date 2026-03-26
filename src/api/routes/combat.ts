import { Router, type Request, type Response } from 'express';
import { GameCommandManager } from '../../game/GameCommandManager';
import { combatRateLimitMiddleware } from '../middleware/rateLimiter';
import { getContainer } from '../../config/di/appContainer';
import { DI_TOKENS } from '../../config/di/Container';
import type { ICharacterRepository } from '../../domain/repositories';

const router = Router();

// Repository accessors
const container = getContainer();
const getCharRepo = () => container.resolve<ICharacterRepository>(DI_TOKENS.CharacterRepository).getOrThrow();

/**
 * POST /api/v1/combat/attack
 * Attack current or specified target.
 * Body: { objectId?: number }
 */
router.post('/attack', combatRateLimitMiddleware, async (req: Request, res: Response) => {
    const { objectId } = req.body;
    const char = getCharRepo().get();
    const targetId = objectId || char?.targetId;

    // Use provided objectId or current target

    if (!targetId) {
        res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_TARGET',
                message: 'No target specified or selected'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    // Check if GameCommandManager is ready
    if (!GameCommandManager.isReady()) {
        res.status(503).json({
            success: false,
            error: {
                code: 'NOT_READY',
                message: 'Not connected to game server or character not loaded'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    // Send Action packet first to select target on server, then attack
    // This is required by L2J Mobius server - target must be selected before attack
    GameCommandManager.action(targetId, false);
    
    // Small delay to ensure target is selected before attack
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Send attack command via GameCommandManager
    const success = GameCommandManager.attack(targetId, false);
    
    if (success) {
        res.json({
            success: true,
            data: {
                message: 'Attack command sent',
                targetId
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    } else {
        res.status(500).json({
            success: false,
            error: {
                code: 'ATTACK_FAILED',
                message: 'Failed to send attack command'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    }
});

/**
 * POST /api/v1/combat/stop
 * Stop auto-attack.
 */
router.post('/stop', combatRateLimitMiddleware, (req: Request, res: Response) => {
    const char = getCharRepo().get();
    if (char) {
        char.setInCombat(false);
    }

    res.json({
        success: true,
        data: {
            message: 'Stop attack command sent'
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

export default router;
