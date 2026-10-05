/**
 * One attempt at a course in a term — the transcript. `in_progress` rows are
 * courses being taken now (no letter yet); a retake is a new row.
 */
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import type { AttemptStatus } from '../domain/academics/types';

export interface GradeModel extends Model<InferAttributes<GradeModel>, InferCreationAttributes<GradeModel>> {
  id: CreationOptional<number>;
  studentId: number;
  courseId: number;
  termId: number;
  score: number | null;
  letter: string | null;
  gradePoint: number | null;
  passed: CreationOptional<boolean>;
  status: AttemptStatus;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

export const Grade = sequelize.define<GradeModel>(
  'Grade',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    studentId: { type: DataTypes.INTEGER, allowNull: false, field: 'student_id' },
    courseId: { type: DataTypes.INTEGER, allowNull: false, field: 'course_id' },
    termId: { type: DataTypes.INTEGER, allowNull: false, field: 'term_id' },
    score: { type: DataTypes.INTEGER, allowNull: true, validate: { min: 0, max: 100 } },
    letter: { type: DataTypes.STRING(4), allowNull: true },
    // FLOAT, not DECIMAL: pg returns DECIMAL as a string.
    gradePoint: { type: DataTypes.FLOAT, allowNull: true, field: 'grade_point' },
    passed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    status: { type: DataTypes.ENUM('completed', 'in_progress', 'withdrawn'), allowNull: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    tableName: 'grades',
    timestamps: true,
    indexes: [{ unique: true, fields: ['student_id', 'course_id', 'term_id'] }, { fields: ['student_id'] }],
  }
);
