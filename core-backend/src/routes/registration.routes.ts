/**
 * Registration routes for students. Everything needs a token; everything
 * below `requireStudent` acts on the caller's own student record only — the
 * student id never comes from the URL, so it cannot be probed.
 */
import { Router } from 'express';
import { registrationController as c } from '../controllers/registration.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireStudent } from '../middleware/student.middleware';

const router = Router();
router.use(requireAuth);

// GET  /api/registration/current — open term + class periods
router.get('/current', c.current);
// GET  /api/registration/rules   — enabled rules and their sources
router.get('/rules', c.rules);

router.use(requireStudent);

// Хичээл сонголт 2 — class times and teachers
router.get('/terms/:termId/schedule', c.schedule);
router.post('/terms/:termId/schedule/suggest', c.suggest);
router.post('/terms/:termId/schedule/apply', c.apply);
router.post('/terms/:termId/schedule', c.pickSection);
router.delete('/terms/:termId/schedule/:sectionId', c.dropSection);

// Graduation plan and curriculum
router.get('/curriculum', c.curriculum);
router.get('/plan/options', c.planOptions);
router.post('/plan', c.plan);

export const registrationRoutes = router;
