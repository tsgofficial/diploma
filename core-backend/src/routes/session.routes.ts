/**
 * Session routes.
 */
import { Router } from 'express';
import { sessionController } from '../controllers/session.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// GET    /api/sessions              — list my conversations
router.get('/', requireAuth, sessionController.list);
// POST   /api/sessions              — start a conversation
router.post('/', requireAuth, sessionController.create);
// GET    /api/sessions/:id/messages — read a transcript
router.get('/:id/messages', requireAuth, sessionController.messages);
// PATCH  /api/sessions/:id          — rename
router.patch('/:id', requireAuth, sessionController.rename);
// DELETE /api/sessions/:id          — delete with its messages
router.delete('/:id', requireAuth, sessionController.remove);

export const sessionRoutes = router;
