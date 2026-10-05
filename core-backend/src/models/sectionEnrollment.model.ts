/**
 * Хичээл сонголт 2: the section a student took for one component of a
 * course. `courseId` and `sectionType` are copied from the section so the
 * database itself guarantees one lecture / one seminar / one lab per course.
 */
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import type { SectionType } from '../domain/academics/types';

export interface SectionEnrollmentModel
  extends Model<InferAttributes<SectionEnrollmentModel>, InferCreationAttributes<SectionEnrollmentModel>> {
  id: CreationOptional<number>;
  studentId: number;
  termId: number;
  sectionId: number;
  courseId: number;
  sectionType: SectionType;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

export const SectionEnrollment = sequelize.define<SectionEnrollmentModel>(
  'SectionEnrollment',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    studentId: { type: DataTypes.INTEGER, allowNull: false, field: 'student_id' },
    termId: { type: DataTypes.INTEGER, allowNull: false, field: 'term_id' },
    sectionId: { type: DataTypes.INTEGER, allowNull: false, field: 'section_id' },
    courseId: { type: DataTypes.INTEGER, allowNull: false, field: 'course_id' },
    sectionType: { type: DataTypes.ENUM('lecture', 'seminar', 'lab'), allowNull: false, field: 'section_type' },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    tableName: 'section_enrollments',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['student_id', 'section_id'] },
      { unique: true, fields: ['student_id', 'term_id', 'course_id', 'section_type'] },
      { fields: ['section_id'] },
    ],
  }
);
