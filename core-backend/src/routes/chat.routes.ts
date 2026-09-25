/**
 * Chat routes.
 */
import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// POST /api/chat — send a message, get the assistant's grounded reply.
router.post('/', requireAuth, chatController.handleSendMessage);
// POST /api/chat/stream — same, as server-sent events (status/sources/delta/done/saved).
router.post('/stream', requireAuth, chatController.handleStream);

export const chatRoutes = router;
