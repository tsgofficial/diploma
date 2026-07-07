/**
 * Auth controller — thin HTTP adapter for register/login.
 * Validates input at the edge, delegates to the auth service.
 */
import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { createHttpError } from '../utils/httpError';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const authController = {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, name } = req.body ?? {};

      if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
        throw createHttpError(400, 'a valid email is required');
      }
      if (typeof password !== 'string' || password.length < 8) {
        throw createHttpError(400, 'password must be at least 8 characters');
      }

      const result = await authService.register(
        email.toLowerCase().trim(),
        password,
        typeof name === 'string' ? name.trim() : undefined
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body ?? {};

      if (typeof email !== 'string' || typeof password !== 'string') {
        throw createHttpError(400, 'email and password are required');
      }

      const result = await authService.login(email.toLowerCase().trim(), password);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
};
