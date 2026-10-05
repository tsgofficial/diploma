/**
 * Data access for the transcript (one row per course attempt).
 */
import { Transaction } from 'sequelize';
import { Grade, GradeModel } from '../models/grade.model';
import { Term, TermModel } from '../models/term.model';

export type GradeWithTerm = GradeModel & { term?: TermModel };

export const gradeRepo = {
  async listByStudent(studentId: number, t?: Transaction): Promise<GradeWithTerm[]> {
    return Grade.findAll({
      where: { studentId },
      include: [{ model: Term, as: 'term' }],
      transaction: t,
    }) as Promise<GradeWithTerm[]>;
  },
};
