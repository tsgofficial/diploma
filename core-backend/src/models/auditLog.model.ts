/**
 * Audit log — who did what to the knowledge base (and to user roles).
 *
 * The rag-engine's own SQLite knows nothing about our users, so this table is
 * the only record of *which admin* uploaded, superseded, or deleted a
 * document. `sequelize.define()` — no classes.
 */
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from '../config/database';

export interface AuditLogModel
  extends Model<InferAttributes<AuditLogModel>, InferCreationAttributes<AuditLogModel>> {
  id: CreationOptional<string>;
  userId: string;
  action: string; // e.g. document.upload, document.delete, user.role
  target: string | null; // document id, job id, user id…
  meta: Record<string, unknown> | null;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

export const AuditLog = sequelize.define<AuditLogModel>(
  'AuditLog',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
    action: { type: DataTypes.STRING, allowNull: false },
    target: { type: DataTypes.STRING, allowNull: true },
    meta: { type: DataTypes.JSONB, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    tableName: 'audit_logs',
    timestamps: true,
    indexes: [{ fields: ['created_at'] }],
  }
);
