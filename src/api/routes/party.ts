import { Router, type Request, type Response } from 'express';
import { GameCommandManager } from '../../game/GameCommandManager';
import { Logger } from '../../logger/Logger';
import { getContainer } from '../../config/di';
import { DI_TOKENS } from '../../config/di/Container';
import type { GameState } from '../../game/GameState';
const router = Router();

/**
 * GET /api/v1/party
 * Returns party information.
 */
router.get('/', (req: Request, res: Response) => {
    const container = getContainer();
    const gameState = container.resolve<GameState>(DI_TOKENS.GameState).getOrThrow();

    const party = {
        inParty: gameState.party.length > 0,
        isLeader: false, // TODO: Need to implement party leadership detection
        members: gameState.party.map(member => ({
            objectId: member.objectId,
            name: member.name,
            level: member.level,
            classId: member.classId,
            className: member.className,
            hp: member.hp,
            maxHp: member.maxHp,
            mp: member.mp,
            maxMp: member.maxMp,
            cp: member.cp,
            maxCp: member.maxCp
        }))
    };

    res.json({
        success: true,
        data: party,
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * POST /api/v1/party/invite
 * Invite player to party.
 * Body: { playerName: string }
 */
router.post('/invite', (req: Request, res: Response) => {
    const { playerName } = req.body;

    if (!playerName || typeof playerName !== 'string' || playerName.trim().length === 0) {
        res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_TARGET',
                message: 'playerName is required and must be a non-empty string'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    const trimmedName = playerName.trim();

    // Send party invite via GameCommandManager
    const success = GameCommandManager.inviteToParty(trimmedName);

    if (success) {
        Logger.info('PartyRoute', `Party invite sent to: ${trimmedName}`);
        res.json({
            success: true,
            data: {
                message: 'Party invite sent',
                playerName: trimmedName
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    } else {
        res.json({
            success: true,
            data: null,
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    }
});

/**
 * POST /api/v1/party/leave
 * Leave current party.
 */
router.post('/leave', (req: Request, res: Response) => {
    const container = getContainer();
    const gameState = container.resolve<GameState>(DI_TOKENS.GameState).getOrThrow();
    const inParty = gameState.party.length > 0;

    if (!inParty) {
        res.status(400).json({
            success: false,
            error: {
                code: 'NOT_IN_PARTY',
                message: 'Not currently in a party'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    // Send leave party command via GameCommandManager
    const success = GameCommandManager.leaveParty();

    if (success) {
        Logger.info('PartyRoute', 'Leave party command sent');
        res.json({
            success: true,
            data: {
                message: 'Leave party command sent'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    } else {
        res.json({
            success: true,
            data: null,
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    }
});

export default router;
