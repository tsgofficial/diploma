/**
 * Admin routes — knowledge-base management and user roles. Every route
 * requires a valid JWT whose role is `admin`.
 */
import { Router } from 'express';
import multer from 'multer';
import { env } from '../config/env';
import { documentController } from '../controllers/document.controller';
import { adminController } from '../controllers/admin.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();
router.use(requireAuth, requireRole('admin'));

// PDF held in memory just long enough to forward to the engine.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
});

// Knowledge base
router.get('/documents', documentController.listAll);
router.post('/documents', upload.single('file'), documentController.upload);
router.get('/documents/:id', documentController.get);
router.post('/documents/:id/supersede', documentController.supersede);
router.patch('/documents/:id/status', documentController.setStatus);
router.delete('/documents/:id', documentController.remove);
router.post('/reingest', documentController.reingest);
router.get('/jobs', documentController.jobs);
router.get('/jobs/:id', documentController.job);

// Users + audit
router.get('/users', adminController.listUsers);
router.patch('/users/:id/role', adminController.setRole);
router.get('/audit', adminController.audit);

export const adminRoutes = router;
