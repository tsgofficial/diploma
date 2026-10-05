/**
 * Prerequisite edge (өмнөх холбоо хичээл, 8.6). Rows with the same
 * `groupNo` for a course are alternatives (OR); different groups must all be
 * satisfied (AND): CS315 ← {group 1: CS211 | SE302}.
 */
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export interface CoursePrerequisiteModel
  extends Model<InferAttributes<CoursePrerequisiteModel>, InferCreationAttributes<CoursePrerequisiteModel>> {
  id: CreationOptional<number>;
  courseId: number;
  prerequisiteId: number;
  groupNo: CreationOptional<number>;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

export const CoursePrerequisite = sequelize.define<CoursePrerequisiteModel>(
  'CoursePrerequisite',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    courseId: { type: DataTypes.INTEGER, allowNull: false, field: 'course_id' },
    prerequisiteId: { type: DataTypes.INTEGER, allowNull: false, field: 'prerequisite_id' },
    groupNo: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'group_no' },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    tableName: 'course_prerequisites',
    timestamps: true,
    indexes: [{ unique: true, fields: ['course_id', 'prerequisite_id'] }],
    validate: {
      notSelf(this: CoursePrerequisiteModel) {
        if (this.courseId === this.prerequisiteId) throw new Error('a course cannot be its own prerequisite');
      },
    },
  }
);
