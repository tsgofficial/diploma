/**
 * Data access for chat sessions. Plain functions, Sequelize methods only.
 */
import { ChatSession, ChatSessionModel } from '../models/chatSession.model';

export interface CreateSessionInput {
  userId?: string | null;
  title?: string | null;
}

export const sessionRepo = {
  /** Create a new conversation session. */
  async create(input: CreateSessionInput = {}): Promise<ChatSessionModel> {
    return ChatSession.create({
      userId: input.userId ?? null,
      title: input.title ?? null,
    });
  },

  /** Look up a session by id (null if not found). */
  async findById(id: string): Promise<ChatSessionModel | null> {
    return ChatSession.findByPk(id);
  },

  /** List a user's sessions, newest first. */
  async listByUser(userId: string): Promise<ChatSessionModel[]> {
    return ChatSession.findAll({
      where: { userId },
      order: [['updatedAt', 'DESC']],
    });
  },
};
