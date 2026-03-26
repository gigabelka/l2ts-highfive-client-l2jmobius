import { Router, type Request, type Response } from 'express';
import { GameCommandManager } from '../../game/GameCommandManager';
import { ChatType } from '../../game/packets/outgoing';

const router = Router();

// In-memory chat history (last 500 messages)
const chatHistory: Array<{
    channel: string;
    senderName: string;
    senderObjectId?: number;
    message: string;
    receivedAt: string;
}> = [];

const MAX_HISTORY = 500;

// Map API channel names to ChatType
const channelToChatType: Record<string, ChatType> = {
    'ALL': ChatType.ALL,
    'SHOUT': ChatType.SHOUT,
    'TELL': ChatType.TELL,
    'PARTY': ChatType.PARTY,
    'CLAN': ChatType.CLAN,
    'TRADE': ChatType.TRADE,
    'HERO': ChatType.HERO_VOICE,
    'WHISPER': ChatType.WHISPER,
    'ALLIANCE': ChatType.ALLIANCE
};

/**
 * POST /api/v1/chat/send
 * Send a chat message.
 * Body: { channel: string, message: string, target?: string }
 */
router.post('/send', (req: Request, res: Response) => {
    const { channel, message, target } = req.body;

    const validChannels = Object.keys(channelToChatType);
    
    if (!validChannels.includes(channel)) {
        res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_CHANNEL',
                message: `Invalid channel. Valid: ${validChannels.join(', ')}`
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    if ((channel === 'TELL' || channel === 'WHISPER') && !target) {
        res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_TARGET',
                message: 'TELL/WHISPER channel requires target parameter'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
        res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_MESSAGE',
                message: 'Message cannot be empty'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    // Send chat via GameCommandManager
    const chatType = channelToChatType[channel];
    const success = GameCommandManager.sendChat(message, chatType, target || '');

    if (success) {
        res.json({
            success: true,
            data: {
                message: 'Chat message sent',
                channel,
                text: message
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
 * GET /api/v1/chat/history
 * Get chat history.
 * Query params:
 *   - channel: filter by channel
 *   - limit: number (max 100, default 50)
 *   - since: ISO timestamp
 */
router.get('/history', (req: Request, res: Response) => {
    const channel = req.query['channel'] as string | undefined;
    const limit = Math.min(parseInt(req.query['limit'] as string) || 50, 100);
    const since = req.query['since'] as string | undefined;

    let messages = [...chatHistory];

    if (channel) {
        messages = messages.filter(m => m.channel === channel);
    }

    if (since) {
        const sinceDate = new Date(since);
        messages = messages.filter(m => new Date(m.receivedAt) >= sinceDate);
    }

    messages = messages.slice(-limit);

    res.json({
        success: true,
        data: {
            messages
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

export function addChatMessage(message: typeof chatHistory[0]): void {
    chatHistory.push(message);
    if (chatHistory.length > MAX_HISTORY) {
        chatHistory.shift();
    }
}

export default router;
