import { Router, type Request, type Response } from 'express';
import { GameCommandManager } from '../../game/GameCommandManager';
import { Logger } from '../../logger/Logger';
import { NpcDatabase } from '../../data/NpcDatabase';
import { getContainer } from '../../config/di/appContainer';
import { DI_TOKENS } from '../../config/di/Container';
import type { ICharacterRepository, IWorldRepository } from '../../domain/repositories';

const router = Router();

// Repository accessors
const container = getContainer();
const getCharRepo = () => container.resolve<ICharacterRepository>(DI_TOKENS.CharacterRepository).getOrThrow();
const getWorldRepo = () => container.resolve<IWorldRepository>(DI_TOKENS.WorldRepository).getOrThrow();

/**
 * GET /api/v1/target
 * Returns current target information.
 */
router.get('/', (req: Request, res: Response) => {
    const char = getCharRepo().get();
    const worldRepo = getWorldRepo();
    const targetId = char?.targetId;

    if (!targetId) {
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

    // Find target in world state
    const npcTarget = worldRepo.getNpc(targetId);
    const playerTarget = undefined; // Player repository not yet implemented
    const target = npcTarget || playerTarget;

    // Get NPC name from database if available
    let targetName = target?.name;
    if (npcTarget) {
        const npcData = NpcDatabase.getNpc(npcTarget.npcId);
        if (npcData?.name) {
            targetName = npcData.name;
        }
    }

    res.json({
        success: true,
        data: {
            objectId: targetId,
            name: targetName,
            type: npcTarget ? 'NPC' : 'PLAYER',
            ...(target && {
                level: target.level,
                hp: target.hp.toJSON(),
                position: target.position.toJSON(),
                ...(npcTarget && {
                    npcId: npcTarget.npcId,
                    isAttackable: npcTarget.isAttackable,
                    isAggressive: npcTarget.isAggressive
                })
            })
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * POST /api/v1/target/next
 * Switch to next nearest target (NPC). Only selects target, does not attack.
 */
router.post('/next', (req: Request, res: Response) => {
    const character = getCharRepo().get();
    const worldRepo = getWorldRepo();

    if (!character || !character.id) {
        Logger.warn('TargetRoute', 'No character found in repository');
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

    // Get nearby NPCs within 1200 range, sorted by distance
    const nearbyNpcs = worldRepo.getNearbyNpcs(character.position, 1200, { alive: true })
        .sort((a, b) => (a.distance || 0) - (b.distance || 0));

    if (nearbyNpcs.length === 0) {
        res.status(400).json({
            success: false,
            error: {
                code: 'NO_TARGETS',
                message: 'No targets nearby'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    // Find next target
    let nextTarget = nearbyNpcs[0]!;
    const currentTargetId = character.targetId;

    if (currentTargetId) {
        const currentIndex = nearbyNpcs.findIndex(npc => npc.id === currentTargetId);
        if (currentIndex >= 0 && currentIndex < nearbyNpcs.length - 1) {
            // Select next target in list
            nextTarget = nearbyNpcs[currentIndex + 1]!;
        } else {
            // Wrap around to first target or keep current if only one
            nextTarget = nearbyNpcs[0]!;
        }
    }

    // Get NPC name from database for better display
    const npcData = NpcDatabase.getNpc(nextTarget.npcId);
    const npcName = npcData?.name || nextTarget.name;

    // Update local state only - do NOT send Action packet to server
    // because Action packet triggers auto-attack behavior on L2J Mobius
    // Use update() to persist changes since get() returns a clone
    getCharRepo().update((char) => {
        char.setTarget(nextTarget.id, npcName, 'NPC');
        return char;
    });

    Logger.info('TargetRoute', `Next target selected (local only): ${npcName} (${nextTarget.id}) at ${nextTarget.distance?.toFixed(1)}m`);

    res.json({
        success: true,
        data: {
            objectId: nextTarget.id,
            name: npcName,
            level: nextTarget.level,
            npcId: nextTarget.npcId,
            distance: nextTarget.distance,
            hp: nextTarget.hp.toJSON(),
            isAttackable: nextTarget.isAttackable,
            isAggressive: nextTarget.isAggressive
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * POST /api/v1/target/next-attack
 * Switch to next nearest target (NPC) and attack it immediately.
 */
router.post('/next-attack', (req: Request, res: Response) => {
    const character = getCharRepo().get();
    const worldRepo = getWorldRepo();

    if (!character || !character.id) {
        Logger.warn('TargetRoute', 'No character found in repository');
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

    // Get nearby attackable NPCs within 1200 range, sorted by distance
    const nearbyNpcs = worldRepo.getNearbyNpcs(character.position, 1200, { attackable: true, alive: true })
        .sort((a, b) => (a.distance || 0) - (b.distance || 0));

    if (nearbyNpcs.length === 0) {
        res.status(400).json({
            success: false,
            error: {
                code: 'NO_TARGETS',
                message: 'No attackable targets nearby'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    // Find next target
    let nextTarget = nearbyNpcs[0]!;
    const currentTargetId = character.targetId;

    if (currentTargetId) {
        const currentIndex = nearbyNpcs.findIndex(npc => npc.id === currentTargetId);
        if (currentIndex >= 0 && currentIndex < nearbyNpcs.length - 1) {
            // Select next target in list
            nextTarget = nearbyNpcs[currentIndex + 1]!;
        } else {
            // Wrap around to first target or keep current if only one
            nextTarget = nearbyNpcs[0]!;
        }
    }

    // Get NPC name from database for better display
    const npcData = NpcDatabase.getNpc(nextTarget.npcId);
    const npcName = npcData?.name || nextTarget.name;

    // Send Action packet to server to select target
    const actionSuccess = GameCommandManager.action(nextTarget.id, false);
    
    // Update local state with database name - use update() to persist changes
    getCharRepo().update((char) => {
        char.setTarget(nextTarget.id, npcName, 'NPC');
        return char;
    });

    // Immediately attack the target
    const attackSuccess = GameCommandManager.attack(nextTarget.id, false);

    Logger.info('TargetRoute', `Next target selected and attacked: ${npcName} (${nextTarget.id}) at ${nextTarget.distance?.toFixed(1)}m`);

    res.json({
        success: true,
        data: {
            objectId: nextTarget.id,
            name: npcName,
            level: nextTarget.level,
            npcId: nextTarget.npcId,
            distance: nextTarget.distance,
            hp: nextTarget.hp.toJSON(),
            isAttackable: nextTarget.isAttackable,
            isAggressive: nextTarget.isAggressive,
            actionSent: actionSuccess,
            attackSent: attackSuccess
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * POST /api/v1/target/set
 * Set target by objectId.
 */
router.post('/set', (req: Request, res: Response) => {
    const { objectId, name, type } = req.body;

    if (typeof objectId !== 'number') {
        res.status(400).json({
            success: false,
            error: { code: 'INVALID_PARAMETER', message: 'objectId must be a number' },
            meta: { timestamp: new Date().toISOString(), requestId: req.requestId }
        });
        return;
    }

    // Send Action packet to server to select target
    const actionSuccess = GameCommandManager.action(objectId, false);

    // Update local state
    const char = getCharRepo().get();
    if (char) {
        char.setTarget(objectId, name || '', type || 'NPC');
    }

    res.json({
        success: true,
        data: { 
            objectId, 
            name: name || '', 
            type: type || 'NPC',
            actionSent: actionSuccess
        },
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId }
    });
});

/**
 * POST /api/v1/target/clear
 * Clear current target.
 */
router.post('/clear', (req: Request, res: Response) => {
    // Send Action packet with objectId 0 to clear target
    GameCommandManager.action(0, false);
    
    const char = getCharRepo().get();
    if (char) {
        char.clearTarget();
    }

    res.json({
        success: true,
        data: { message: 'Target cleared' },
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId }
    });
});

export default router;
