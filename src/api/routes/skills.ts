import { Router, type Request, type Response } from 'express';
import { GameCommandManager } from '../../game/GameCommandManager';
import { SkillDatabase } from '../../data/SkillDatabase';
import { Logger } from '../../logger/Logger';
import { getContainer } from '../../config/di/appContainer';
import { DI_TOKENS } from '../../config/di/Container';
import type { ICharacterRepository } from '../../domain/repositories';

const router = Router();

// Repository accessors
const container = getContainer();
const getCharRepo = () => container.resolve<ICharacterRepository>(DI_TOKENS.CharacterRepository).getOrThrow();

/**
 * GET /api/v1/skills
 * Returns list of character skills with names from database.
 * Returns empty array when not connected to game server.
 */
router.get('/', (req: Request, res: Response) => {
    const character = getCharRepo().get();
    
    // Return empty skills when not in game
    if (!character || !character.id) {
        res.json({
            success: true,
            data: {
                skills: [],
                totalCount: 0,
                activeCount: 0,
                passiveCount: 0,
                inGame: false
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }
    
    const skills = Array.from(character.skills) || [];

    // Transform skills to ensure consistent format with names
    const formattedSkills = skills.map(skill => {
        // Try to get name from database if not present
        const skillName = skill.name || SkillDatabase.getSkillName(skill.id || 0);
        const skillType = SkillDatabase.getSkillType(skill.id || 0);
        
        return {
            skillId: skill.id,
            level: skill.level,
            name: skillName || `Skill #${skill.id}`,
            isPassive: skill.isPassive,
            type: skillType || (skill.isPassive ? 'PASSIVE' : 'ACTIVE')
        };
    });

    res.json({
        success: true,
        data: {
            skills: formattedSkills,
            totalCount: formattedSkills.length,
            activeCount: formattedSkills.filter(s => !s.isPassive).length,
            passiveCount: formattedSkills.filter(s => s.isPassive).length,
            inGame: true
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * POST /api/v1/skills/use
 * Use a skill.
 * Body: { skillId: number, ctrlPressed?: boolean, shiftPressed?: boolean }
 */
router.post('/use', (req: Request, res: Response) => {
    const { skillId, ctrlPressed, shiftPressed } = req.body;

    if (typeof skillId !== 'number') {
        res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_PARAMETER',
                message: 'skillId is required and must be a number'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    const character = getCharRepo().get();
    const skills = character ? Array.from(character.skills) : [];
    
    // Validate skill exists in character's skill list
    const skill = skills.find((s: { id?: number; skillId?: number }) => s.id === skillId || s.skillId === skillId);
    if (!skill) {
        res.status(400).json({
            success: false,
            error: {
                code: 'SKILL_NOT_FOUND',
                message: `Skill ${skillId} not found in character skill list`
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    // Get skill name from database
    const skillName = SkillDatabase.getSkillName(skillId) || skill.name || `Skill #${skillId}`;

    // Send skill use command via GameCommandManager
    const success = GameCommandManager.useSkill(skillId, ctrlPressed || false, shiftPressed || false);

    if (success) {
        Logger.info('SkillsRoute', `Skill use command sent: ${skillId} (${skillName})`);
        res.json({
            success: true,
            data: {
                message: 'Skill use command sent',
                skillId,
                skillName,
                ctrlPressed: ctrlPressed || false,
                shiftPressed: shiftPressed || false
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
 * GET /api/v1/skills/shortcuts
 * Returns skill shortcuts (hotkeys).
 */
router.get('/shortcuts', (req: Request, res: Response) => {
    // TODO: Implement shortcuts storage in new architecture
    // For now, return empty array
    res.json({
        success: true,
        data: {
            shortcuts: []
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

export default router;
