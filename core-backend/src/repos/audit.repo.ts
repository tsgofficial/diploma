/**
 * Data access for the audit log. Plain functions, Sequelize methods only.
 */
import { AuditLog, AuditLogModel } from '../models/auditLog.model';

export interface AuditInput {
  userId: string;
  action: string;
  target?: string | null;
  meta?: Record<string, unknown> | null;
}

export const auditRepo = {
  async record(input: AuditInput): Promise<AuditLogModel> {
    return AuditLog.create({
      userId: input.userId,
      action: input.action,
      target: input.target ?? null,
      meta: input.meta ?? null,
    });
  },

  async recent(limit = 100): Promise<AuditLogModel[]> {
    return AuditLog.findAll({ order: [['createdAt', 'DESC']], limit });
  },
};
