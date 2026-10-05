/**
 * Data access for academic terms. Plain functions, Sequelize methods only.
 */
import { Transaction } from 'sequelize';
import { Term, TermModel, TermPhase } from '../models/term.model';

export const termRepo = {
  /** The term students are registering for right now. */
  async current(): Promise<TermModel | null> {
    return Term.findOne({ where: { isCurrent: true } });
  },

  async findById(id: number, t?: Transaction): Promise<TermModel | null> {
    return Term.findByPk(id, { transaction: t });
  },

  async list(): Promise<TermModel[]> {
    return Term.findAll({ order: [['seq', 'DESC']] });
  },

  async setPhase(id: number, phase: TermPhase): Promise<TermModel | null> {
    const term = await Term.findByPk(id);
    if (!term) return null;
    term.phase = phase;
    await term.save();
    return term;
  },
};
