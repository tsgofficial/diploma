/**
 * Class section — one teacher's lecture, seminar or lab group for a course
 * in a term. `capacity` / `enrolledCount` mirror the university's data for
 * information; this app plans timetables and does not count seats.
 */
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import type { SectionType } from '../domain/academics/types';

export interface SectionModel extends Model<InferAttributes<SectionModel>, InferCreationAttributes<SectionModel>> {
  id: CreationOptional<number>;
  termId: number;
  courseId: number;
  type: SectionType;
  code: string;
  instructorId: number | null;
  capacity: number;
  enrolledCount: CreationOptional<number>;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

export const Section = sequelize.define<SectionModel>(
  'Section',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    termId: { type: DataTypes.INTEGER, allowNull: false, field: 'term_id' },
    courseId: { type: DataTypes.INTEGER, allowNull: false, field: 'course_id' },
    type: { type: DataTypes.ENUM('lecture', 'seminar', 'lab'), allowNull: false },
    code: { type: DataTypes.STRING(8), allowNull: false },
    instructorId: { type: DataTypes.INTEGER, allowNull: true, field: 'instructor_id' },
    capacity: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 } },
    enrolledCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'enrolled_count' },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    tableName: 'sections',
    timestamps: true,
    indexes: [{ unique: true, fields: ['term_id', 'course_id', 'code'] }, { fields: ['term_id'] }],
  }
);
