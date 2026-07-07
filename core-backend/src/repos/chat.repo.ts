/**
 * Data access for chat messages.
 *
 * Exported as a plain object of functions — no classes, no `this`. Every call
 * goes through Sequelize model methods; there is no raw SQL anywhere.
 */
import { ChatMessage, ChatMessageModel, ChatMessageRole } from '../models/chatMessage.model';

export interface CreateMessageInput {
  sessionId: string;
  role: ChatMessageRole;
  content: string;
  sources?: string[] | null;
}

export const chatRepo = {
  /** Insert a single message row and return the created record. */
  async create(input: CreateMessageInput): Promise<ChatMessageModel> {
    return ChatMessage.create({
      sessionId: input.sessionId,
      role: input.role,
      content: input.content,
      sources: input.sources ?? null,
    });
  },

  /**
   * Fetch prior messages for a session in chronological order.
   * `limit` caps how much history we forward to the LLM (token control).
   */
  async findBySession(sessionId: string, limit = 20): Promise<ChatMessageModel[]> {
    return ChatMessage.findAll({
      where: { sessionId },
      order: [['createdAt', 'ASC']],
      limit,
    });
  },

  /** Count messages in a session (e.g. to auto-title on the first turn). */
  async countBySession(sessionId: string): Promise<number> {
    return ChatMessage.count({ where: { sessionId } });
  },
};
