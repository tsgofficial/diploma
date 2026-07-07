/**
 * Chat routes.
 */
import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// POST /api/chat — send a message, get the assistant's grounded reply.
router.post('/', requireAuth, chatController.handleSendMessage);

export const chatRoutes = router;
