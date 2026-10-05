/**
 * Registrar tools — switch a term's registration phase and tune rules.
 */
import { Request, Response, NextFunction } from 'express';
import { termService } from '../services/term.service';
import { ruleService } from '../services/rule.service';
import { TermPhase } from '../models/term.model';
import { createHttpError } from '../utils/httpError';

export const registrationAdminController = {
  async terms(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({ terms: await termService.list() });
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/admin/registration/terms/:id/phase { phase } */
  async setPhase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) throw createHttpError(400, 'invalid term id');
      res.json(await termService.setPhase(req.userId as string, id, req.body?.phase as TermPhase));
    } catch (err) {
      next(err);
    }
  },

  async rules(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({ rules: await ruleService.list(true) });
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/admin/registration/rules/:code — partial update, validated before save. */
  async updateRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patch = req.body;
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw createHttpError(400, 'body must be an object');
      res.json(await ruleService.update(req.userId as string, req.params.code, patch));
    } catch (err) {
      next(err);
    }
  },
};
