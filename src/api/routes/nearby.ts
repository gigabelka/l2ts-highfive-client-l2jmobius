/**
 * @fileoverview Nearby API Routes - использует новую архитектуру (Repositories)
 * @module api/routes/nearby
 */

import { Router, type Request, type Response } from 'express';
import { getContainer } from '../../config/di/appContainer';
import { DI_TOKENS } from '../../config/di/Container';
import type { ICharacterRepository, IWorldRepository } from '../../domain/repositories';
import { NpcDatabase } from '../../data/NpcDatabase';
import { GameCommandManager } from '../../game/GameCommandManager';

const router = Router();

/**
 * GET /api/v1/nearby/npcs
 * Returns NPCs in visible range.
 */
router.get('/npcs', (req: Request, res: Response) => {
    const container = getContainer();
    const charRepo = container.resolve<ICharacterRepository>(DI_TOKENS.CharacterRepository).getOrThrow();
    const worldRepo = container.resolve<IWorldRepository>(DI_TOKENS.WorldRepository).getOrThrow();

    const radius = Math.min(parseInt(req.query['radius'] as string) || 600, 2000);
    const attackable = req.query['attackable'] !== undefined
        ? req.query['attackable'] === 'true'
        : undefined;
    const alive = req.query['alive'] !== undefined
        ? req.query['alive'] === 'true'
        : true;

    const character = charRepo.get();
    if (!character) {
        res.json({
            success: true,
            data: null,
            meta: { timestamp: new Date().toISOString(), requestId: req.requestId }
        });
        return;
    }

    const npcs = worldRepo.getNearbyNpcs(character.position, radius, { attackable, alive }).map(npc => {
        const npcData = NpcDatabase.getNpc(npc.npcId);
        return {
            objectId: npc.id,
            npcId: npc.npcId,
            name: npcData?.name || npc.name,
            level: npc.level,
            hp: { current: npc.hp.current, max: npc.hp.max },
            isAttackable: npc.isAttackable,
            isAggressive: npc.isAggressive,
            position: {
                x: npc.position.x,
                y: npc.position.y,
                z: npc.position.z,
            },
            distance: npc.distance,
        };
    });

    res.json({
        success: true,
        data: {
            count: npcs.length,
            npcs
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * GET /api/v1/nearby/npc/:id
 * Returns NPC name from database by npcId.
 */
router.get('/npc/:id', (req: Request, res: Response) => {
    const npcId = parseInt(req.params['id'] as string);

    if (isNaN(npcId)) {
        res.status(400).json({
            success: false,
            error: { code: 'INVALID_PARAMETER', message: 'Invalid npcId' },
            meta: { timestamp: new Date().toISOString(), requestId: req.requestId }
        });
        return;
    }

    const npcData = NpcDatabase.getNpc(npcId);

    if (!npcData) {
        res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: `NPC with id ${npcId} not found in database` },
            meta: { timestamp: new Date().toISOString(), requestId: req.requestId }
        });
        return;
    }

    res.json({
        success: true,
        data: {
            npcId: npcData.id,
            name: npcData.name,
            title: npcData.title,
            type: npcData.type,
            level: npcData.level
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * GET /api/v1/nearby/npc/search?name=xxx
 * Search NPCs by name (partial match) in database.
 */
router.get('/npc/search', (req: Request, res: Response) => {
    const name = req.query['name'] as string;
    const limit = Math.min(parseInt(req.query['limit'] as string) || 20, 100);

    if (!name || name.length < 2) {
        res.status(400).json({
            success: false,
            error: { code: 'INVALID_PARAMETER', message: 'Name parameter required (min 2 characters)' },
            meta: { timestamp: new Date().toISOString(), requestId: req.requestId }
        });
        return;
    }

    const npcs = NpcDatabase.findByName(name).slice(0, limit);

    res.json({
        success: true,
        data: {
            query: name,
            count: npcs.length,
            npcs: npcs.map(npc => ({
                npcId: npc.id,
                name: npc.name,
                title: npc.title,
                type: npc.type,
                level: npc.level
            }))
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * GET /api/v1/nearby/players
 * Returns players in visible range.
 */
router.get('/players', (req: Request, res: Response) => {
    const container = getContainer();
    const charRepo = container.resolve<ICharacterRepository>(DI_TOKENS.CharacterRepository).getOrThrow();

    const character = charRepo.get();
    if (!character) {
        res.json({
            success: true,
            data: null,
            meta: { timestamp: new Date().toISOString(), requestId: req.requestId }
        });
        return;
    }

    // TODO: Implement players in IWorldRepository
    interface NearbyPlayerInfo {
        objectId: number;
        name: string;
        level: number;
        distance: number;
    }
    const players: NearbyPlayerInfo[] = []; // worldRepo.getNearbyPlayers?.(character.position, radius) || [];

    res.json({
        success: true,
        data: {
            count: players.length,
            players
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * GET /api/v1/nearby/items
 * Returns items on ground in visible range.
 */
router.get('/items', (req: Request, res: Response) => {
    const container = getContainer();
    const worldRepo = container.resolve<IWorldRepository>(DI_TOKENS.WorldRepository).getOrThrow();
    const charRepo = container.resolve<ICharacterRepository>(DI_TOKENS.CharacterRepository).getOrThrow();

    const radius = Math.min(parseInt(req.query['radius'] as string) || 600, 2000);

    const character = charRepo.get();
    if (!character) {
        res.json({
            success: true,
            data: null,
            meta: { timestamp: new Date().toISOString(), requestId: req.requestId }
        });
        return;
    }

    const items = worldRepo.getNearbyItems(character.position, radius).map(item => ({
        objectId: item.id,
        itemId: item.itemId,
        name: item.name,
        count: item.count,
        position: {
            x: item.position.x,
            y: item.position.y,
            z: item.position.z,
        },
        distance: item.distance,
    }));

    res.json({
        success: true,
        data: {
            count: items.length,
            items
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * POST /api/v1/nearby/pickup
 * Pickup an item by objectId.
 * Body: { objectId: number }
 */
router.post('/pickup', async (req: Request, res: Response) => {
    const { objectId } = req.body;

    if (typeof objectId !== 'number') {
        res.status(400).json({
            success: false,
            error: { code: 'INVALID_PARAMETER', message: 'objectId must be a number' },
            meta: { timestamp: new Date().toISOString(), requestId: req.requestId }
        });
        return;
    }

    if (!GameCommandManager.isReady()) {
        res.status(503).json({
            success: false,
            error: { code: 'NOT_READY', message: 'Not connected to game server' },
            meta: { timestamp: new Date().toISOString(), requestId: req.requestId }
        });
        return;
    }

    const success = await GameCommandManager.pickupItem(objectId);

    if (success) {
        res.json({
            success: true,
            data: { message: 'Pickup command sent', objectId },
            meta: { timestamp: new Date().toISOString(), requestId: req.requestId }
        });
    } else {
        res.status(500).json({
            success: false,
            error: { code: 'PICKUP_FAILED', message: 'Failed to pickup item' },
            meta: { timestamp: new Date().toISOString(), requestId: req.requestId }
        });
    }
});

export default router;
