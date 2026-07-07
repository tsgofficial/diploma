/**
 * Chat controller — thin HTTP adapter.
 *
 * Validates input at the edge, delegates to the service, and never touches the
 * DB or the AI client directly. Plain object of handler functions.
 */
import { Request, Response, NextFunction } from 'express';
import { chatService } from '../services/chat.service';
import { createHttpError } from '../utils/httpError';

export const chatController = {
  async handleSendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId, question } = req.body ?? {};

      if (typeof sessionId !== 'string' || !sessionId.trim()) {
        throw createHttpError(400, 'sessionId is required');
      }
      if (typeof question !== 'string' || !question.trim()) {
        throw createHttpError(400, 'question is required');
      }

      const result = await chatService.sendMessage({
        sessionId,
        question: question.trim(),
        userId: req.userId ?? null,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err); // funnel to the central error middleware
    }
  },
};
