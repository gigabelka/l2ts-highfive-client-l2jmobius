/**
 * @fileoverview Debug API Routes - для диагностики состояния системы
 * @module api/routes/debug
 */

import { Router, type Request, type Response } from 'express';
import { getContainer } from '../../config/di/appContainer';
import { DI_TOKENS } from '../../config/di/Container';
import type { ICharacterRepository, IWorldRepository } from '../../domain/repositories';
import type { WorldItem } from '../../domain/entities';
import { GameCommandManager } from '../../game/GameCommandManager';

const router = Router();

/**
 * GET /api/v1/debug/world
 * Показать состояние WorldRepository для диагностики
 */
router.get('/world', (req: Request, res: Response) => {
    try {
        const container = getContainer();
        const charRepo = container.resolve<ICharacterRepository>(DI_TOKENS.CharacterRepository).getOrThrow();
        const worldRepo = container.resolve<IWorldRepository>(DI_TOKENS.WorldRepository).getOrThrow();

        const char = charRepo.get();
        const allNpcs = worldRepo.getAllNpcs();
        const allItems = worldRepo.getAllItems();

        let nearbyNpcs = [];
        let nearbyItems = [];

        if (char) {
            nearbyNpcs = worldRepo.getNearbyNpcs(char.position, 600);
            nearbyItems = worldRepo.getNearbyItems(char.position, 200);
        }

        const debugInfo = {
            character: char ? {
                name: char.name,
                level: char.level,
                position: char.position,
                isDead: char.isDead
            } : null,
            worldRepository: {
                totalNpcs: allNpcs.length,
                totalItems: allItems.length,
                nearbyNpcs: nearbyNpcs.length,
                nearbyItems: nearbyItems.length
            },
            npcs: allNpcs.map(npc => ({
                id: npc.id,
                name: npc.name,
                level: npc.level,
                position: npc.position,
                isAlive: npc.isAlive,
                isAttackable: npc.isAttackable,
                distance: char ? char.position.distanceTo(npc.position) : null
            })),
            items: allItems.map(item => ({
                id: item.id,
                itemId: item.itemId,
                name: item.name,
                count: item.count,
                position: item.position,
                distance: char ? char.position.distanceTo(item.position) : null
            })),
            gameCommandManager: {
                isReady: GameCommandManager ? GameCommandManager.isReady() : false,
                hasGameClient: GameCommandManager ? !!GameCommandManager['gameClient'] : false
            }
        };

        res.json({
            success: true,
            data: debugInfo,
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });

    } catch (error) {
        console.error('[DebugRoute] Error getting world debug info:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'DEBUG_ERROR',
                message: 'Failed to get debug information',
                details: error instanceof Error ? error.message : String(error)
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    }
});

/**
 * GET /api/v1/debug/pickup/:objectId
 * Проверить почему конкретный item не может быть поднят
 */
router.get('/pickup/:objectId', (req: Request, res: Response) => {
    try {
        const objectIdParam = req.params['objectId'] as string;
        const objectId = parseInt(objectIdParam);

        if (isNaN(objectId)) {
            res.status(400).json({
                success: false,
                error: { code: 'INVALID_PARAMETER', message: 'objectId must be a number' },
                meta: { timestamp: new Date().toISOString(), requestId: req.requestId }
            });
            return;
        }

        const container = getContainer();
        const charRepo = container.resolve<ICharacterRepository>(DI_TOKENS.CharacterRepository).getOrThrow();
        const worldRepo = container.resolve<IWorldRepository>(DI_TOKENS.WorldRepository).getOrThrow();

        const char = charRepo.get();
        const item = worldRepo.getItem(objectId);
        const allItems = worldRepo.getAllItems();

        let nearbyItems: Array<WorldItem & { distance: number }> = [];
        let targetItemInNearby: (WorldItem & { distance: number }) | undefined = undefined;

        if (char) {
            nearbyItems = worldRepo.getNearbyItems(char.position, 200);
            targetItemInNearby = nearbyItems.find(i => i.id === objectId);
        }

        const debugInfo = {
            objectId,
            itemFoundInWorldRepo: !!item,
            itemFoundInNearby: !!targetItemInNearby,
            character: char ? {
                name: char.name,
                position: char.position
            } : null,
            targetItem: item || targetItemInNearby || null,
            distance: item && char ? char.position.distanceTo(item.position) : null,
            canPickup: {
                gameReady: GameCommandManager ? GameCommandManager.isReady() : false,
                characterExists: !!char,
                itemExists: !!(item || targetItemInNearby),
                withinRange: item && char ? char.position.distanceTo(item.position) <= 150 : false
            },
            worldState: {
                totalItems: allItems.length,
                nearbyItems: nearbyItems.length,
                allItemIds: allItems.map(i => i.id),
                nearbyItemIds: nearbyItems.map(i => i.id)
            }
        };

        res.json({
            success: true,
            data: debugInfo,
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });

    } catch (error) {
        console.error('[DebugRoute] Error getting pickup debug info:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'DEBUG_ERROR',
                message: 'Failed to get pickup debug information',
                details: error instanceof Error ? error.message : String(error)
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    }
});

export default router;