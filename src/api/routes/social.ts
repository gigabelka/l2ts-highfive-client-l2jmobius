import { Router, type Request, type Response } from 'express';
import { Logger } from '../../logger/Logger';
import { GameCommandManager } from '../../game/GameCommandManager';

const router = Router();

/**
 * POST /api/v1/social/action
 * Perform a social action (sit, stand, wave, etc.)
 * 
 * Action IDs (from l2J-Mobius):
 * 1 - Sit/Stand toggle
 * 2 - Greeting/Wave
 * 3 - Victory
 * 4 - Advance
 * 5 - No
 * 6 - Yes
 * 7 - Bow
 * 8 - Unaware
 * 9 - Waiting
 * 10 - Laugh
 * 11 - Think
 * 12 - Applaud
 * 13 - Dance
 */

/**
 * POST /api/v1/social/sit
 * Toggle sit/stand
 * Body: { stand?: boolean } - true=stand, false=sit (default: toggle)
 */
router.post('/sit', (req: Request, res: Response) => {
    const { stand } = req.body;
    
    // Send toggle sit via GameCommandManager
    const success = GameCommandManager.toggleSit(stand);
    
    if (success) {
        res.json({
            success: true,
            data: {
                action: stand ? 'stand' : 'sit',
                performed: true
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

router.post('/action', (req: Request, res: Response) => {
    const { actionId } = req.body;

    if (typeof actionId !== 'number') {
        res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_PARAMETER',
                message: 'actionId must be a number'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    // Send social action via GameCommandManager
    const success = GameCommandManager.socialAction(actionId);
    
    // Action names for logging
    const actionNames: Record<number, string> = {
        1: 'Sit/Stand',
        2: 'Greeting',
        3: 'Victory',
        4: 'Advance',
        5: 'No',
        6: 'Yes',
        7: 'Bow',
        8: 'Unaware',
        9: 'Waiting',
        10: 'Laugh',
        11: 'Think',
        12: 'Applaud',
        13: 'Dance'
    };

    const actionName = actionNames[actionId] || `Action ${actionId}`;

    if (success) {
        Logger.info('SocialRoute', `Social action performed: ${actionName} (${actionId})`);
        res.json({
            success: true,
            data: {
                actionId,
                actionName,
                performed: true,
                timestamp: new Date().toISOString()
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
 * GET /api/v1/social/actions
 * Get list of available social actions
 * Note: Sit/Stand is NOT a social action, use separate endpoint
 */
router.get('/actions', (req: Request, res: Response) => {
    const actions = [
        { id: 2, name: 'Greeting', description: 'Wave hand / Greeting' },
        { id: 3, name: 'Victory', description: 'Victory pose' },
        { id: 4, name: 'Advance', description: 'Advance gesture' },
        { id: 5, name: 'No', description: 'Shake head no' },
        { id: 6, name: 'Yes', description: 'Nod head yes' },
        { id: 7, name: 'Bow', description: 'Bow respectfully' },
        { id: 8, name: 'Unaware', description: 'Look around unaware' },
        { id: 9, name: 'Waiting', description: 'Waiting stance' },
        { id: 10, name: 'Laugh', description: 'Laugh' },
        { id: 11, name: 'Think', description: 'Thinking pose' },
        { id: 12, name: 'Applaud', description: 'Applaud' },
        { id: 13, name: 'Dance', description: 'Dance' }
    ];

    res.json({
        success: true,
        data: actions,
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

export default router;
