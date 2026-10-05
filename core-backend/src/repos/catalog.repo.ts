/**
 * Data access for the course catalog and curricula. Plain functions,
 * Sequelize methods only.
 */
import { Transaction } from 'sequelize';
import { Course, CourseModel } from '../models/course.model';
import { CoursePrerequisite, CoursePrerequisiteModel } from '../models/coursePrerequisite.model';
import { Program, ProgramModel } from '../models/program.model';
import { RequirementCategory, RequirementCategoryModel } from '../models/requirementCategory.model';
import { CurriculumCourse, CurriculumCourseModel } from '../models/curriculumCourse.model';
import { CourseOffering } from '../models/courseOffering.model';

export type CourseWithPrereqs = CourseModel & { prerequisites?: CoursePrerequisiteModel[] };

export const catalogRepo = {
  /** Every course with its prerequisite edges (the catalog is small: tens of rows). */
  async courses(t?: Transaction): Promise<CourseWithPrereqs[]> {
    return Course.findAll({
      include: [{ model: CoursePrerequisite, as: 'prerequisites' }],
      order: [['code', 'ASC']],
      transaction: t,
    }) as Promise<CourseWithPrereqs[]>;
  },

  async courseById(id: number): Promise<CourseModel | null> {
    return Course.findByPk(id);
  },

  async program(id: number, t?: Transaction): Promise<ProgramModel | null> {
    return Program.findByPk(id, { transaction: t });
  },

  async categories(programId: number, t?: Transaction): Promise<RequirementCategoryModel[]> {
    return RequirementCategory.findAll({ where: { programId }, order: [['sortOrder', 'ASC']], transaction: t });
  },

  async curriculum(programId: number, t?: Transaction): Promise<CurriculumCourseModel[]> {
    return CurriculumCourse.findAll({ where: { programId }, transaction: t });
  },

  /** Course ids opened in a term (Хичээл сонголт 1 catalog). */
  async offeredCourseIds(termId: number, t?: Transaction): Promise<number[]> {
    const rows = await CourseOffering.findAll({ where: { termId }, attributes: ['courseId'], transaction: t });
    return rows.map((r) => r.courseId);
  },
};
