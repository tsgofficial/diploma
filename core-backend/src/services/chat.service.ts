/**
 * Chat orchestration.
 *
 * This is the heart of the "decoupled AI" rule: the backend persists the user
 * message, asks the engine, persists the reply, and returns it. The engine is
 * reached only through `ai.service` — this module never speaks HTTP itself.
 *
 * Two entry points share the same steps: `sendMessage` (one reply object)
 * and `streamMessage` (an async generator of events, ending with `saved`).
 */
import { chatRepo } from '../repos/chat.repo';
import { sessionRepo } from '../repos/session.repo';
import { aiService } from './ai.service';
import { createHttpError } from '../utils/httpError';
import { Citation } from '../models/chatMessage.model';
import { HistoryTurn, RagStreamEvent } from '../types/chat.types';

export interface SendMessageInput {
  sessionId: string;
  question: string;
  userId: string | null;
}

export interface SendMessageResult {
  answer: string;
  sources: string[];
  citations: Citation[];
  refused: boolean;
}

/** Events the browser receives: the engine's, plus `saved` once persisted. */
export type ChatStreamEvent =
  | RagStreamEvent
  | { type: 'saved'; messageId: string; sessionTitle: string | null };

const TITLE_MAX = 60;

function titleFrom(question: string): string {
  const oneLine = question.replace(/\s+/g, ' ').trim();
  return oneLine.length > TITLE_MAX ? `${oneLine.slice(0, TITLE_MAX - 1)}…` : oneLine;
}

/**
 * Steps 1–3 shared by both entry points: check ownership, persist the user
 * turn, load prior history, auto-title on the first turn.
 */
async function begin(input: SendMessageInput): Promise<{ history: HistoryTurn[]; sessionTitle: string | null }> {
  const { sessionId, question, userId } = input;

  const session = await sessionRepo.findById(sessionId);
  // Treat "not yours" as "not found" so session ids can't be probed.
  if (!session || session.userId !== userId) {
    throw createHttpError(404, 'session not found');
  }

  // Persist the user's message first (durability — never lose it).
  await chatRepo.create({ sessionId, role: 'user', content: question });

  // Build PRIOR conversation history. We fetch the recent window then drop
  // the last turn — the question we just inserted — so the engine condenses
  // the follow-up against context only.
  const recent = await chatRepo.findBySession(sessionId, 21);
  const history: HistoryTurn[] = recent.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));

  let sessionTitle = session.title;
  if (!sessionTitle && recent.length === 1) {
    sessionTitle = titleFrom(question);
    await sessionRepo.updateTitle(sessionId, sessionTitle);
  }
  return { history, sessionTitle };
}

async function finish(sessionId: string, answer: string, sources: string[], citations: Citation[]): Promise<string> {
  const saved = await chatRepo.create({ sessionId, role: 'assistant', content: answer, sources, citations });
  await sessionRepo.touch(sessionId);
  return saved.id;
}

export const chatService = {
  /** One-shot turn: persist question → ask engine → persist reply → return it. */
  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const { history } = await begin(input);
    const rag = await aiService.query({ question: input.question, history });
    await finish(input.sessionId, rag.answer, rag.sources, rag.citations);
    return { answer: rag.answer, sources: rag.sources, citations: rag.citations, refused: rag.refused };
  },

  /**
   * Streaming turn. Yields the engine's events as they arrive and, after the
   * engine's `done`, persists the full reply and yields `saved`. If the
   * engine reports `error`, nothing is persisted for the assistant turn.
   */
  async *streamMessage(input: SendMessageInput): AsyncGenerator<ChatStreamEvent> {
    const { history, sessionTitle } = await begin(input);

    let sources: string[] = [];
    let citations: Citation[] = [];
    let answer = '';

    for await (const event of aiService.stream({ question: input.question, history })) {
      if (event.type === 'sources') {
        sources = event.sources;
        citations = event.citations;
      } else if (event.type === 'delta') {
        answer += event.text;
      } else if (event.type === 'done') {
        answer = event.answer || answer;
      }
      yield event;
      if (event.type === 'error') return;
      if (event.type === 'done') {
        const messageId = await finish(input.sessionId, answer, sources, citations);
        yield { type: 'saved', messageId, sessionTitle };
        return;
      }
    }
  },
};
