/**
 * Terms: the current registration term for students, and the registrar's
 * phase switch (Хичээл сонголт 1 → Хичээл сонголт 2 → …).
 */
import { termRepo } from '../repos/term.repo';
import { auditRepo } from '../repos/audit.repo';
import { TermModel, TermPhase } from '../models/term.model';
import { termDto } from './academicContext.service';
import { createHttpError } from '../utils/httpError';

export const TERM_PHASES: TermPhase[] = ['upcoming', 'selection', 'schedule', 'in_progress', 'closed'];

export const termService = {
  async current(): Promise<TermModel> {
    const term = await termRepo.current();
    if (!term) throw createHttpError(404, 'no registration term is open', { code: 'no_term' });
    return term;
  },

  async list() {
    return (await termRepo.list()).map(termDto);
  },

  async setPhase(adminId: string, id: number, phase: TermPhase) {
    if (!TERM_PHASES.includes(phase)) throw createHttpError(400, `phase must be one of ${TERM_PHASES.join(', ')}`);
    const before = await termRepo.findById(id);
    if (!before) throw createHttpError(404, 'term not found');
    const previous = before.phase;
    const term = (await termRepo.setPhase(id, phase))!;
    await auditRepo.record({ userId: adminId, action: 'term.phase', target: term.code, meta: { from: previous, to: phase } });
    return termDto(term);
  },
};
