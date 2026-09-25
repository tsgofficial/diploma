/**
 * Auth routes — register/login are public; /me needs a token.
 */
import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// POST /api/auth/register — create an account, returns { user, token }
router.post('/register', authController.register);
// POST /api/auth/login    — authenticate, returns { user, token }
router.post('/login', authController.login);
// GET  /api/auth/me       — current user (id, email, name, role)
router.get('/me', requireAuth, authController.me);

export const authRoutes = router;
