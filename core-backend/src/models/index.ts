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

// A user has many sessions; a session has many messages.
User.hasMany(ChatSession, { foreignKey: 'userId', as: 'sessions' });
ChatSession.belongsTo(User, { foreignKey: 'userId', as: 'user' });

ChatSession.hasMany(ChatMessage, { foreignKey: 'sessionId', as: 'messages' });
ChatMessage.belongsTo(ChatSession, { foreignKey: 'sessionId', as: 'session' });

/**
 * Sync models to the database. For a diploma/dev setup `sync` is fine;
 * switch to Sequelize migrations before production.
 */
export async function syncModels(): Promise<void> {
  await sequelize.sync();
}

export { sequelize, User, ChatSession, ChatMessage };
