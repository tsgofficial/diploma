/**
 * Хичээл сонголт 1: a course a student chose for a term. The unique index
 * makes a double submission impossible; history lives in the audit log.
 */
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export interface CourseSelectionModel
  extends Model<InferAttributes<CourseSelectionModel>, InferCreationAttributes<CourseSelectionModel>> {
  id: CreationOptional<number>;
  studentId: number;
  termId: number;
  courseId: number;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

export const CourseSelection = sequelize.define<CourseSelectionModel>(
  'CourseSelection',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    studentId: { type: DataTypes.INTEGER, allowNull: false, field: 'student_id' },
    termId: { type: DataTypes.INTEGER, allowNull: false, field: 'term_id' },
    courseId: { type: DataTypes.INTEGER, allowNull: false, field: 'course_id' },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    tableName: 'course_selections',
    timestamps: true,
    indexes: [{ unique: true, fields: ['student_id', 'term_id', 'course_id'] }, { fields: ['term_id'] }],
  }
);
