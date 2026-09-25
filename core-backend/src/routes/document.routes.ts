/**
 * Document routes for signed-in users — read-only ("what can I ask about?").
 */
import { Router } from 'express';
import { documentController } from '../controllers/document.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// GET /api/documents      — active documents in the knowledge base
router.get('/', requireAuth, documentController.list);
// GET /api/documents/:id  — one document's metadata
router.get('/:id', requireAuth, documentController.get);
// GET /api/documents/:id/pages/:page — one page of the original PDF as a PNG
router.get('/:id/pages/:page', requireAuth, documentController.page);
// GET /api/documents/:id/file — the original PDF
router.get('/:id/file', requireAuth, documentController.file);

export const documentRoutes = router;
