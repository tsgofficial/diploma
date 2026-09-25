/**
 * Chat controller — thin HTTP adapter.
 *
 * Validates input at the edge, delegates to the service, and never touches the
 * DB or the AI client directly. Plain object of handler functions.
 */
import { Request, Response, NextFunction } from 'express';
import { chatService } from '../services/chat.service';
import { createHttpError } from '../utils/httpError';

function readInput(req: Request): { sessionId: string; question: string } {
  const { sessionId, question } = req.body ?? {};
  if (typeof sessionId !== 'string' || !sessionId.trim()) {
    throw createHttpError(400, 'sessionId is required');
  }
  if (typeof question !== 'string' || !question.trim()) {
    throw createHttpError(400, 'question is required');
  }
  return { sessionId, question: question.trim() };
}

export const chatController = {
  async handleSendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId, question } = readInput(req);
      const result = await chatService.sendMessage({ sessionId, question, userId: req.userId ?? null });
      res.status(200).json(result);
    } catch (err) {
      next(err); // funnel to the central error middleware
    }
  },

  /**
   * POST /api/chat/stream — server-sent events. Once headers are flushed we
   * can no longer send an HTTP error, so failures become an `error` event.
   * The service keeps consuming the engine (and persists the reply) even if
   * the browser disconnects mid-answer, so history stays complete.
   */
  async handleStream(req: Request, res: Response, next: NextFunction): Promise<void> {
    let input: { sessionId: string; question: string };
    try {
      input = readInput(req);
    } catch (err) {
      next(err);
      return;
    }

    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    let clientGone = false;
    res.on('close', () => {
      clientGone = true;
    });
    const send = (event: { type: string; [key: string]: unknown }) => {
      if (clientGone) return;
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    };

    try {
      for await (const event of chatService.streamMessage({ ...input, userId: req.userId ?? null })) {
        send(event);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'stream failed';
      const status = err instanceof Error && 'status' in err ? (err as { status: number }).status : 500;
      if (status >= 500) console.error('[chat.stream]', err);
      send({ type: 'error', message: status < 500 ? message : 'Internal server error' });
    } finally {
      if (!clientGone) res.end();
    }
  },
};
