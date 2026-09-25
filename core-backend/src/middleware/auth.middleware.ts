/**
 * Auth middleware — verifies a Bearer JWT and attaches `req.userId` and
 * `req.userRole`. `requireRole` builds a guard for admin-only routes.
 */
import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { UserRole } from '../models/user.model';
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
    req.userRole = payload.role;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Guard factory: `router.use(requireAuth, requireRole('admin'))`.
 * The role comes from the JWT, so a promotion takes effect on next login.
 */
export function requireRole(role: UserRole) {
  return function roleGuard(req: Request, _res: Response, next: NextFunction): void {
    if (req.userRole !== role) {
      next(createHttpError(403, 'forbidden'));
      return;
    }
    next();
  };
}
