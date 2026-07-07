/**
 * Auth middleware — verifies a Bearer JWT and attaches `req.userId`.
 * Rejects requests without a valid token.
 */
import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { createHttpError } from '../utils/httpError';

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw createHttpError(401, 'missing bearer token');
    }

    const payload = authService.verifyToken(token);
    req.userId = payload.sub;
    next();
  } catch (err) {
    next(err);
  }
}
