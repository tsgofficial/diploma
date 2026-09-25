/**
 * Model registry + associations.
 *
 * Central place to wire relationships and run schema sync. No classes — just
 * the model objects produced by `sequelize.define()`.
 */
import { sequelize } from '../config/database';
import { User } from './user.model';
import { ChatSession } from './chatSession.model';
import { ChatMessage } from './chatMessage.model';
import { AuditLog } from './auditLog.model';

// A user has many sessions; a session has many messages.
User.hasMany(ChatSession, { foreignKey: 'userId', as: 'sessions' });
ChatSession.belongsTo(User, { foreignKey: 'userId', as: 'user' });

ChatSession.hasMany(ChatMessage, { foreignKey: 'sessionId', as: 'messages' });
ChatMessage.belongsTo(ChatSession, { foreignKey: 'sessionId', as: 'session' });

User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

/**
 * Sync models to the database. For a diploma/dev setup `sync` is fine;
 * switch to Sequelize migrations before production.
 */
export async function syncModels(): Promise<void> {
  // `alter` adds columns introduced after the first release (users.role,
  // chat_messages.citations). Dev-only convenience — migrations for prod.
  await sequelize.sync({ alter: true });
}

export { sequelize, User, ChatSession, ChatMessage, AuditLog };
