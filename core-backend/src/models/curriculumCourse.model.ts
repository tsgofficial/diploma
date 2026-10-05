/**
 * Course ↔ program mapping: which requirement category a course fills in a
 * program, and in which semester the recommended study plan places it.
 */
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export interface CurriculumCourseModel
  extends Model<InferAttributes<CurriculumCourseModel>, InferCreationAttributes<CurriculumCourseModel>> {
  id: CreationOptional<number>;
  programId: number;
  courseId: number;
  categoryId: number;
  recommendedSemester: number | null;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

export const CurriculumCourse = sequelize.define<CurriculumCourseModel>(
  'CurriculumCourse',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    programId: { type: DataTypes.INTEGER, allowNull: false, field: 'program_id' },
    courseId: { type: DataTypes.INTEGER, allowNull: false, field: 'course_id' },
    categoryId: { type: DataTypes.INTEGER, allowNull: false, field: 'category_id' },
    recommendedSemester: { type: DataTypes.INTEGER, allowNull: true, field: 'recommended_semester' },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    tableName: 'curriculum_courses',
    timestamps: true,
    indexes: [{ unique: true, fields: ['program_id', 'course_id'] }],
  }
);
