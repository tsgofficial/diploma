/**
 * A course opened in a term — what Хичээл сонголт 1 lets students choose
 * from, before class times exist.
 */
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export interface CourseOfferingModel
  extends Model<InferAttributes<CourseOfferingModel>, InferCreationAttributes<CourseOfferingModel>> {
  id: CreationOptional<number>;
  termId: number;
  courseId: number;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

export const CourseOffering = sequelize.define<CourseOfferingModel>(
  'CourseOffering',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    termId: { type: DataTypes.INTEGER, allowNull: false, field: 'term_id' },
    courseId: { type: DataTypes.INTEGER, allowNull: false, field: 'course_id' },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { tableName: 'course_offerings', timestamps: true, indexes: [{ unique: true, fields: ['term_id', 'course_id'] }] }
);
