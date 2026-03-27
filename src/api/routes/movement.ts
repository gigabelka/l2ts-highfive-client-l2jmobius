import { Router, type Request, type Response } from 'express';
import { GameCommandManager } from '../../game/GameCommandManager';
import { moveRateLimitMiddleware } from '../middleware/rateLimiter';
import { Logger } from '../../logger/Logger';
import { getContainer } from '../../config/di/appContainer';
import { DI_TOKENS } from '../../config/di/Container';
import type { ICharacterRepository, IWorldRepository } from '../../domain/repositories';

// Simple movement tracking
let lastMoveCommand: { time: number; destination: { x: number; y: number; z: number } } | null = null;
let movementStopped = false;


const router = Router();

// Repository accessors
const container = getContainer();
const getCharRepo = () => container.resolve<ICharacterRepository>(DI_TOKENS.CharacterRepository).getOrThrow();
const getWorldRepo = () => container.resolve<IWorldRepository>(DI_TOKENS.WorldRepository).getOrThrow();

/**
 * POST /api/v1/move/to
 * Move to coordinates.
 * Body: { x: number, y: number, z: number, validateRange?: boolean }
 */
router.post('/to', moveRateLimitMiddleware, (req: Request, res: Response) => {
    const { x, y, z, validateRange } = req.body;
    const character = getCharRepo().get();

    if (!character?.position) {
        res.json({
            success: true,
            data: null,
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    // Validate range if requested
    if (validateRange) {
        const dx = x - character!.position.x;
        const dy = y - character!.position.y;
        const dz = z - character!.position.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distance > 50000) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'MOVEMENT_BLOCKED',
                    message: 'Destination too far from current position'
                },
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId
                }
            });
            return;
        }
    }

    // Send move command via GameCommandManager
    const success = GameCommandManager.moveTo(x, y, z);

    if (success) {
        // Track movement command
        lastMoveCommand = { time: Date.now(), destination: { x, y, z } };
        movementStopped = false;
        res.json({
            success: true,
            data: {
                message: 'Move command sent',
                destination: { x, y, z },
                from: character!.position
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
 * POST /api/v1/move/stop
 * Stop movement.
 */
router.post('/stop', moveRateLimitMiddleware, (req: Request, res: Response) => {
    const character = getCharRepo().get();

    if (!character?.position) {
        res.json({
            success: true,
            data: null,
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    // Send stop movement command via GameCommandManager
    const success = GameCommandManager.stopMove();

    if (success) {
        // Mark movement as stopped
        movementStopped = true;
        Logger.info('MovementRoute', `Stop movement command sent at ${character!.position.x},${character!.position.y},${character!.position.z}`);
        res.json({
            success: true,
            data: {
                message: 'Stop movement command sent',
                position: character!.position
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
 * GET /api/v1/move/status
 * Get current movement status.
 */
router.get('/status', (req: Request, res: Response) => {
    const character = getCharRepo().get();
    
    // Determine if character is in game based on character existence
    const isInGame = character !== null;
    const hasPosition = character?.position !== undefined && character?.position !== null;
    
    // Basic movement tracking based on sent commands
    let isMoving = false;
    let destination: { x: number; y: number; z: number } | null = null;
    let estimatedArrivalTime: number | null = null;

    if (lastMoveCommand && !movementStopped && character?.position) {
        const timeSinceMove = Date.now() - lastMoveCommand.time;
        const dx = lastMoveCommand.destination.x - character.position.x;
        const dy = lastMoveCommand.destination.y - character.position.y;
        const dz = lastMoveCommand.destination.z - character.position.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Assume average movement speed ~120 units/second
        const estimatedTravelTime = distance / 120 * 1000; // in milliseconds

        if (timeSinceMove < estimatedTravelTime + 2000) { // +2 seconds buffer
            isMoving = true;
            destination = lastMoveCommand.destination;
            estimatedArrivalTime = lastMoveCommand.time + estimatedTravelTime;
        }
    }

    res.json({
        success: true,
        data: {
            isMoving,
            isInGame,
            hasPosition,
            position: character?.position?.toJSON() || null,
            speed: character?.combatStats?.speed || 120, // Default L2 walking speed
            destination,
            estimatedArrivalTime: estimatedArrivalTime ? new Date(estimatedArrivalTime).toISOString() : null,
            lastMoveCommand: lastMoveCommand ? {
                time: new Date(lastMoveCommand.time).toISOString(),
                destination: lastMoveCommand.destination
            } : null
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * POST /api/v1/move/follow
 * Follow a target.
 * Body: { objectId: number, minDistance?: number }
 */
router.post('/follow', moveRateLimitMiddleware, (req: Request, res: Response) => {
    const { objectId, minDistance } = req.body;

    if (typeof objectId !== 'number') {
        res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_PARAMETER',
                message: 'objectId is required and must be a number'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    const worldRepo = getWorldRepo();
    
    // Validate target exists
    const npcTarget = worldRepo.getNpc(objectId);
    const playerTarget = undefined; // Player repository not yet implemented
    const target = npcTarget || playerTarget;

    if (!target) {
        res.status(400).json({
            success: false,
            error: {
                code: 'TARGET_NOT_FOUND',
                message: `Target with objectId ${objectId} not found in world`
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    const distance = minDistance || 100;

    // Send follow command via GameCommandManager
    const success = GameCommandManager.follow(objectId, distance);

    if (success) {
        Logger.info('MovementRoute', `Follow command sent: ${target.name} (${objectId}) at distance ${distance}`);
        res.json({
            success: true,
            data: {
                message: 'Follow command sent',
                objectId,
                targetName: target.name,
                targetType: npcTarget ? 'NPC' : 'PLAYER',
                minDistance: distance,
                targetPosition: target.position
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
