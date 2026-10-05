/**
 * Data access for Хичээл сонголт 2 — the sections a student holds.
 */
import { Op, Transaction } from 'sequelize';
import { SectionEnrollment, SectionEnrollmentModel } from '../models/sectionEnrollment.model';
import type { SectionType } from '../domain/academics/types';

export interface EnrollmentInput {
  studentId: number;
  termId: number;
  sectionId: number;
  courseId: number;
  sectionType: SectionType;
}

export const enrollmentRepo = {
  async listByStudentTerm(studentId: number, termId: number, t?: Transaction): Promise<SectionEnrollmentModel[]> {
    return SectionEnrollment.findAll({ where: { studentId, termId }, transaction: t });
  },

  async create(input: EnrollmentInput, t: Transaction): Promise<SectionEnrollmentModel> {
    return SectionEnrollment.create(input, { transaction: t });
  },

  async removeSections(studentId: number, sectionIds: number[], t: Transaction): Promise<number> {
    if (sectionIds.length === 0) return 0;
    return SectionEnrollment.destroy({ where: { studentId, sectionId: { [Op.in]: sectionIds } }, transaction: t });
  },

  /** Drop every section of a course (when the course itself is dropped). */
  async removeCourse(studentId: number, termId: number, courseId: number, t: Transaction): Promise<SectionEnrollmentModel[]> {
    const rows = await SectionEnrollment.findAll({ where: { studentId, termId, courseId }, transaction: t });
    await SectionEnrollment.destroy({ where: { studentId, termId, courseId }, transaction: t });
    return rows;
  },
};
