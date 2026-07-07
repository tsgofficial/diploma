/**
 * Session routes.
 */
import { Router } from 'express';
import { sessionController } from '../controllers/session.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// POST /api/sessions             — start a conversation
router.post('/', requireAuth, sessionController.create);
// GET  /api/sessions/:id/messages — read a transcript
router.get('/:id/messages', requireAuth, sessionController.messages);

export const sessionRoutes = router;
