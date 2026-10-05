/**
 * Augment Express's Request with the authenticated user id, set by
 * `requireAuth`. Keeps controllers free of ad-hoc casts.
 */
import 'express';
import type { UserRole } from '../models/user.model';

declare global {
  namespace Express {
    interface Request {
      userId?: string | null;
      userRole?: UserRole;
      /** Set by `requireStudent` for routes that act on the caller's student record. */
      studentId?: number;
    }
  }
}

export {};
