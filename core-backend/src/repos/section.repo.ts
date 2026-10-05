/**
 * Read access to class sections (the groups offered in Хичээл сонголт 2).
 */
import { Op, Transaction } from 'sequelize';
import { Section, SectionModel } from '../models/section.model';
import { SectionMeeting, SectionMeetingModel } from '../models/sectionMeeting.model';
import { Instructor, InstructorModel } from '../models/instructor.model';

export type SectionFull = SectionModel & { meetings?: SectionMeetingModel[]; instructor?: InstructorModel | null };

export const sectionRepo = {
  async listForCourses(termId: number, courseIds: number[], t?: Transaction): Promise<SectionFull[]> {
    if (courseIds.length === 0) return [];
    return Section.findAll({
      where: { termId, courseId: { [Op.in]: courseIds } },
      include: [
        { model: SectionMeeting, as: 'meetings' },
        { model: Instructor, as: 'instructor' },
      ],
      order: [['courseId', 'ASC'], ['type', 'ASC'], ['code', 'ASC']],
      transaction: t,
    }) as Promise<SectionFull[]>;
  },

  async findById(id: number, t?: Transaction): Promise<SectionModel | null> {
    return Section.findByPk(id, { transaction: t });
  },
};
