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

  /** Set the sidebar title (auto-generated from the first question, or renamed). */
  async updateTitle(id: string, title: string): Promise<void> {
    await ChatSession.update({ title }, { where: { id } });
  },

  /** Bump updatedAt so the session floats to the top of the list. */
  async touch(id: string): Promise<void> {
    await ChatSession.update({ updatedAt: new Date() }, { where: { id } });
  },

  /** Delete a session and its messages (FK cascade via association). */
  async remove(id: string): Promise<void> {
    await ChatSession.destroy({ where: { id } });
  },
};
