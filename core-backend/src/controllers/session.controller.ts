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
  /** GET /api/sessions — the current user's conversations, newest first. */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessions = await sessionRepo.listByUser(req.userId as string);
      res.json({
        sessions: sessions.map((s) => ({ id: s.id, title: s.title, updatedAt: s.updatedAt, createdAt: s.createdAt })),
      });
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/sessions/:id { title } — rename, owner only. */
  async rename(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = await sessionRepo.findById(req.params.id);
      if (!session || session.userId !== req.userId) throw createHttpError(404, 'session not found');
      const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 120) : '';
      if (!title) throw createHttpError(400, 'title is required');
      await sessionRepo.updateTitle(session.id, title);
      res.json({ id: session.id, title });
    } catch (err) {
      next(err);
    }
  },

  /** DELETE /api/sessions/:id — owner only; removes the transcript too. */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = await sessionRepo.findById(req.params.id);
      if (!session || session.userId !== req.userId) throw createHttpError(404, 'session not found');
      await chatRepo.removeBySession(session.id);
      await sessionRepo.remove(session.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },

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
        id: session.id,
        title: session.title,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          sources: m.sources ?? [],
          citations: m.citations ?? [],
          createdAt: m.createdAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
};
