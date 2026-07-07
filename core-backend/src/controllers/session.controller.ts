/**
 * Session controller — create a conversation and read its messages.
 * Plain handler functions; delegates to repos. Every action is scoped to the
 * authenticated user (`req.userId`, set by requireAuth).
 */
import { Request, Response, NextFunction } from 'express';
import { sessionRepo } from '../repos/session.repo';
import { chatRepo } from '../repos/chat.repo';
import { createHttpError } from '../utils/httpError';

export const sessionController = {
  /** POST /api/sessions — start a new conversation for the current user. */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const title = typeof req.body?.title === 'string' ? req.body.title : null;
      const session = await sessionRepo.create({ userId: req.userId ?? null, title });
      res.status(201).json({ id: session.id, title: session.title });
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/sessions/:id/messages — transcript, owner only. */
  async messages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const session = await sessionRepo.findById(id);
      // Treat "not yours" as "not found" so ids can't be probed.
      if (!session || session.userId !== req.userId) {
        throw createHttpError(404, 'session not found');
      }

      const messages = await chatRepo.findBySession(id, 200);
      res.status(200).json({
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          sources: m.sources ?? [],
          createdAt: m.createdAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
};
