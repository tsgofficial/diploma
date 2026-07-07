/**
 * Auth routes — public (no requireAuth).
 */
import { Router } from 'express';
import { authController } from '../controllers/auth.controller';

const router = Router();

// POST /api/auth/register — create an account, returns { user, token }
router.post('/register', authController.register);
// POST /api/auth/login    — authenticate, returns { user, token }
router.post('/login', authController.login);

export const authRoutes = router;
