/**
 * @fileoverview Character API Routes - использует новую архитектуру (Repositories)
 * @module api/routes/character
 */

import { Router, type Request, type Response } from 'express';
import { getContainer } from '../../config/di';
import { DI_TOKENS } from '../../config/di/Container';
import type { ICharacterRepository } from '../../domain/repositories';

const router = Router();

/**
 * GET /api/v1/character
 * Returns full character state.
 */
router.get('/', (req: Request, res: Response) => {
    const container = getContainer();
    const charRepo = container.resolve<ICharacterRepository>(DI_TOKENS.CharacterRepository).getOrThrow();
    const character = charRepo.get();

    if (!character) {
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

    res.json({
        success: true,
        data: {
            objectId: character.id,
            name: character.name,
            title: character.title,
            level: character.level,
            classId: character.classId,
            race: character.raceId,
            sex: character.sex,
            hp: { current: character.hp.current, max: character.hp.max },
            mp: { current: character.mp.current, max: character.mp.max },
            cp: { current: character.cp.current, max: character.cp.max },
            exp: character.experience.exp,
            sp: character.experience.sp,
            position: {
                x: character.position.x,
                y: character.position.y,
                z: character.position.z,
                heading: character.position.heading,
            },
            stats: character.baseStats.toJSON(),
            targetId: character.targetId,
            isInCombat: character.isInCombat,
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * GET /api/v1/character/stats
 * Returns character stats only (lightweight).
 */
router.get('/stats', (req: Request, res: Response) => {
    const container = getContainer();
    const charRepo = container.resolve<ICharacterRepository>(DI_TOKENS.CharacterRepository).getOrThrow();
    const character = charRepo.get();

    if (!character) {
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

    res.json({
        success: true,
        data: {
            objectId: character.id,
            name: character.name,
            level: character.level,
            hp: { current: character.hp.current, max: character.hp.max },
            mp: { current: character.mp.current, max: character.mp.max },
            cp: { current: character.cp.current, max: character.cp.max },
            stats: character.baseStats.toJSON(),
            position: {
                x: character.position.x,
                y: character.position.y,
                z: character.position.z,
            },
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * GET /api/v1/character/buffs
 * Returns active buffs and debuffs.
 */
router.get('/buffs', (req: Request, res: Response) => {
    const container = getContainer();
    const charRepo = container.resolve<ICharacterRepository>(DI_TOKENS.CharacterRepository).getOrThrow();
    const character = charRepo.get();

    if (!character) {
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

    // TODO: Add buffs support to Character entity
    interface BuffInfo {
        id: number;
        name: string;
        duration: number;
        remainingTime: number;
    }
    const buffs: BuffInfo[] = [];
    const debuffs: BuffInfo[] = [];

    res.json({
        success: true,
        data: { buffs, debuffs },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * GET /api/v1/character/skills
 * Returns character skills.
 */
router.get('/skills', (req: Request, res: Response) => {
    const container = getContainer();
    const charRepo = container.resolve<ICharacterRepository>(DI_TOKENS.CharacterRepository).getOrThrow();
    const character = charRepo.get();

    if (!character) {
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

    res.json({
        success: true,
        data: {
            skills: character.skills,
            totalCount: character.skills.length,
            activeCount: character.skills.filter(s => !s.isPassive).length,
            passiveCount: character.skills.filter(s => s.isPassive).length,
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

export default router;
