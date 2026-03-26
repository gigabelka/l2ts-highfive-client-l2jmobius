/**
 * @fileoverview Inventory API Routes - использует новую архитектуру (Repositories)
 * @module api/routes/inventory
 */

import { Router, type Request, type Response } from 'express';
import { getContainer } from '../../config/di/appContainer';
import { DI_TOKENS } from '../../config/di/Container';
import type { ICharacterRepository, IInventoryRepository } from '../../domain/repositories';
import { GameCommandManager } from '../../game/GameCommandManager';
import { Logger } from '../../logger/Logger';

const router = Router();

/**
 * GET /api/v1/inventory
 * Returns character inventory with optional filtering.
 * Query params:
 *   - type: filter by item type (weapon, armor, consumable, material, quest, etc)
 *   - equipped: boolean, filter equipped items only
 *   - format: 'full' | 'compact' | 'stats' (default: 'full')
 */
router.get('/', (req: Request, res: Response) => {
    const container = getContainer();
    const charRepo = container.resolve<ICharacterRepository>(DI_TOKENS.CharacterRepository).getOrThrow();
    const invRepo = container.resolve<IInventoryRepository>(DI_TOKENS.InventoryRepository).getOrThrow();

    const format = (req.query['format'] as string) || 'full';
    const typeFilter = req.query['type'] as string | undefined;
    const equippedFilter = req.query['equipped'] as string | undefined;

    const character = charRepo.get();
    const state = invRepo.getState();

    // Return empty inventory when not in game
    if (!character) {
        res.json({
            success: true,
            data: {
                adena: 0,
                weight: { current: 0, max: 0 },
                items: [],
                equipment: {},
                stats: { totalItems: 0, equippedItems: 0, totalValue: 0 },
                inGame: false
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId,
                format
            }
        });
        return;
    }

    // Get inventory stats
    const stats = {
        totalItems: state.items.length,
        equippedItems: state.items.filter(i => i.equipped).length,
        adena: state.adena,
        weightPercent: state.weight.max > 0 ? Math.round((state.weight.current / state.weight.max) * 100) : 0,
    };

    // Full format (default)
    let items = state.items;

    // Apply filters
    if (typeFilter) {
        items = items.filter((item) => item.type === typeFilter);
    }

    if (equippedFilter !== undefined) {
        const equipped = equippedFilter === 'true';
        items = items.filter((item) => item.equipped === equipped);
    }

    // Compact format
    if (format === 'compact') {
        res.json({
            success: true,
            data: {
                items: state.items.map(item => ({
                    oid: item.id,
                    iid: item.itemId,
                    cnt: item.count,
                    eq: item.equipped,
                    en: item.enchant,
                    sl: item.slot,
                })),
                adena: state.adena,
                weight: state.weight,
                ts: Date.now(),
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId,
                format: 'compact'
            }
        });
        return;
    }

    // Stats only format
    if (format === 'stats') {
        res.json({
            success: true,
            data: stats,
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId,
                format: 'stats'
            }
        });
        return;
    }

    Logger.info('InventoryAPI', `Returning ${items.length} items (format=${format}), adena=${state.adena}`);

    // Format equipment
    const equipment: Record<string, any> = {};
    state.items.filter(i => i.equipped).forEach(item => {
        const slotName = getSlotName(item.slot);
        if (slotName) {
            equipment[slotName] = {
                objectId: item.id,
                itemId: item.itemId,
                name: item.name,
                enchant: item.enchant,
            };
        }
    });

    res.json({
        success: true,
        data: {
            adena: state.adena,
            weight: state.weight,
            items: items.map(item => ({
                objectId: item.id,
                itemId: item.itemId,
                name: item.name,
                count: item.count,
                type: item.type,
                equipped: item.equipped,
                slot: item.slot,
                enchant: item.enchant,
                grade: item.grade,
            })),
            equipment,
            stats,
            inGame: true
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
            format: 'full'
        }
    });
});

/**
 * GET /api/v1/inventory/equipment
 * Returns equipped items only
 */
router.get('/equipment', (req: Request, res: Response) => {
    const container = getContainer();
    const invRepo = container.resolve<IInventoryRepository>(DI_TOKENS.InventoryRepository).getOrThrow();

    const equipped = invRepo.getEquippedItems();

    res.json({
        success: true,
        data: {
            equipped: equipped.map(item => ({
                objectId: item.id,
                itemId: item.itemId,
                name: item.name,
                slot: item.slot,
                enchant: item.enchant,
            })),
            count: equipped.length,
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * GET /api/v1/inventory/search
 * Search items by name
 * Query params:
 *   - q: search query
 */
router.get('/search', (req: Request, res: Response) => {
    const query = req.query['q'] as string;

    if (!query || query.length < 2) {
        res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_QUERY',
                message: 'Search query must be at least 2 characters'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    const container = getContainer();
    const invRepo = container.resolve<IInventoryRepository>(DI_TOKENS.InventoryRepository).getOrThrow();
    const state = invRepo.getState();

    const results = state.items.filter(item =>
        item.name.toLowerCase().includes(query.toLowerCase())
    );

    res.json({
        success: true,
        data: {
            query,
            results: results.map(item => ({
                objectId: item.id,
                itemId: item.itemId,
                name: item.name,
                count: item.count,
                equipped: item.equipped,
            })),
            count: results.length,
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * POST /api/v1/inventory/use
 * Use an item from inventory.
 * Body: { objectId: number }
 */
router.post('/use', (req: Request, res: Response) => {
    const { objectId } = req.body;

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

    const container = getContainer();
    const invRepo = container.resolve<IInventoryRepository>(DI_TOKENS.InventoryRepository).getOrThrow();

    // Validate item exists in inventory
    const item = invRepo.getItem(objectId);
    if (!item) {
        res.status(400).json({
            success: false,
            error: {
                code: 'ITEM_NOT_FOUND',
                message: `Item with objectId ${objectId} not found in inventory`
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    // Send use item command via GameCommandManager
    const success = GameCommandManager.useItem(objectId);

    if (success) {
        Logger.info('InventoryRoute', `Use item command sent: ${item.name} (${objectId})`);
        res.json({
            success: true,
            data: {
                message: 'Use item command sent',
                objectId,
                itemName: item.name,
                itemId: item.itemId
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
 * POST /api/v1/inventory/drop
 * Drop an item on the ground.
 * Body: { objectId: number, count: number, position?: { x: number, y: number, z: number } }
 */
router.post('/drop', (req: Request, res: Response) => {
    const { objectId, count, position } = req.body;

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

    if (typeof count !== 'number' || count <= 0) {
        res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_PARAMETER',
                message: 'count is required and must be a positive number'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    // Validate position if provided
    if (position !== undefined) {
        if (typeof position.x !== 'number' || typeof position.y !== 'number' || typeof position.z !== 'number') {
            res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_PARAMETER',
                    message: 'position must have x, y, z as numbers'
                },
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId
                }
            });
            return;
        }
    }

    const container = getContainer();
    const invRepo = container.resolve<IInventoryRepository>(DI_TOKENS.InventoryRepository).getOrThrow();
    const charRepo = container.resolve<ICharacterRepository>(DI_TOKENS.CharacterRepository).getOrThrow();

    // Validate item exists in inventory
    const item = invRepo.getItem(objectId);
    if (!item) {
        res.status(400).json({
            success: false,
            error: {
                code: 'ITEM_NOT_FOUND',
                message: `Item with objectId ${objectId} not found in inventory`
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    // Validate count doesn't exceed available
    if (count > item.count) {
        res.status(400).json({
            success: false,
            error: {
                code: 'INSUFFICIENT_COUNT',
                message: `Cannot drop ${count} of ${item.name}, only ${item.count} available`
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    // Send drop item command via GameCommandManager
    const success = GameCommandManager.dropItem(objectId, count, position);

    if (success) {
        const char = charRepo.get();
        Logger.info('InventoryRoute', `Drop item command sent: ${item.name} x${count} (${objectId})`);
        res.json({
            success: true,
            data: {
                message: 'Drop item command sent',
                objectId,
                itemName: item.name,
                itemId: item.itemId,
                count,
                position: position || (char ? char.position : undefined)
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
 * Helper to get slot name from slot number
 */
function getSlotName(slot: number): string | undefined {
    const slotMap: Record<number, string> = {
        0: 'underwear',
        1: 'earring_right',
        2: 'earring_left',
        3: 'necklace',
        4: 'ring_right',
        5: 'ring_left',
        6: 'helmet',
        7: 'weapon',
        8: 'shield',
        9: 'gloves',
        10: 'upper_body',
        11: 'lower_body',
        12: 'boots',
        13: 'cloak',
        15: 'two_handed',
    };
    return slotMap[slot];
}

export default router;
