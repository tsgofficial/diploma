/**
 * Read access to Хичээл сонголт 1 — the courses a student chose for a term
 * (made in the university's own system; Хичээл сонголт 2 builds on them).
 */
import { Transaction } from 'sequelize';
import { CourseSelection } from '../models/courseSelection.model';

export const selectionRepo = {
  async courseIds(studentId: number, termId: number, t?: Transaction): Promise<number[]> {
    const rows = await CourseSelection.findAll({
      where: { studentId, termId },
      attributes: ['courseId'],
      order: [['createdAt', 'ASC']],
      transaction: t,
    });
    return rows.map((r) => r.courseId);
  },
};
