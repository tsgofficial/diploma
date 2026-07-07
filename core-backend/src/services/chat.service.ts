/**
 * Chat orchestration.
 *
 * This is the heart of the "decoupled AI" rule: the backend persists the user
 * message, asks the engine, persists the reply, and returns it. The engine is
 * reached only through `ai.service` — this module never speaks HTTP itself.
 */
import { chatRepo } from '../repos/chat.repo';
import { sessionRepo } from '../repos/session.repo';
import { aiService } from './ai.service';
import { createHttpError } from '../utils/httpError';
import { HistoryTurn } from '../types/chat.types';

export interface SendMessageInput {
  sessionId: string;
  question: string;
  userId: string | null;
}

export interface SendMessageResult {
  answer: string;
  sources: string[];
  refused: boolean;
}

export const chatService = {
  /**
   * Orchestrate one chat turn:
   *   1. validate the session exists
   *   2. persist the user message (before any external call — never lose it)
   *   3. load recent history
   *   4. ask the rag-engine over HTTP
   *   5. persist the assistant reply (with its cited sources)
   *   6. return the reply
   */
  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const { sessionId, question, userId } = input;

    const session = await sessionRepo.findById(sessionId);
    // Treat "not yours" as "not found" so session ids can't be probed.
    if (!session || session.userId !== userId) {
      throw createHttpError(404, 'session not found');
    }

    // 2. Persist the user's message first (durability — never lose it).
    await chatRepo.create({ sessionId, role: 'user', content: question });

    // 3. Build PRIOR conversation history (ORM read, no raw SQL). We fetch the
    //    recent window then drop the last turn — that's the question we just
    //    inserted — so the engine condenses the follow-up against context only.
    const recent = await chatRepo.findBySession(sessionId, 21);
    const history: HistoryTurn[] = recent.slice(0, -1).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // 4. Delegate the RAG work to the Python engine.
    const rag = await aiService.query({ question, history });

    // 5. Persist the assistant reply with its citations.
    await chatRepo.create({
      sessionId,
      role: 'assistant',
      content: rag.answer,
      sources: rag.sources,
    });

    // 6. Return to the caller.
    return { answer: rag.answer, sources: rag.sources, refused: rag.refused };
  },
};
