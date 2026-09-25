/**
 * Admin user management — list users, change roles, read the audit log.
 */
import { Request, Response, NextFunction } from 'express';
import { userRepo } from '../repos/user.repo';
import { auditRepo } from '../repos/audit.repo';
import { toPublicUser } from '../services/auth.service';
import { createHttpError } from '../utils/httpError';

export const adminController = {
  async listUsers(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await userRepo.list();
      res.json({ users: users.map((u) => ({ ...toPublicUser(u), createdAt: u.createdAt })) });
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/admin/users/:id/role { role } — never demote the last admin. */
  async setRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { role } = req.body ?? {};
      if (role !== 'user' && role !== 'admin') throw createHttpError(400, 'role must be user or admin');
      const target = await userRepo.findById(req.params.id);
      if (!target) throw createHttpError(404, 'user not found');
      if (target.role === 'admin' && role === 'user' && (await userRepo.countAdmins()) <= 1) {
        throw createHttpError(409, 'cannot demote the last admin');
      }
      const updated = await userRepo.updateRole(target.id, role);
      await auditRepo.record({ userId: req.userId as string, action: 'user.role', target: target.id, meta: { role } });
      res.json(toPublicUser(updated as NonNullable<typeof updated>));
    } catch (err) {
      next(err);
    }
  },

  async audit(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rows = await auditRepo.recent(200);
      res.json({
        entries: rows.map((r) => ({
          id: r.id,
          userId: r.userId,
          action: r.action,
          target: r.target,
          meta: r.meta,
          createdAt: r.createdAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
};
