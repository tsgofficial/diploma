/**
 * Teacher who runs class sections — the "багш" a student chooses in
 * Хичээл сонголт 2.
 */
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export interface InstructorModel extends Model<InferAttributes<InstructorModel>, InferCreationAttributes<InstructorModel>> {
  id: CreationOptional<number>;
  name: string;
  title: string | null;
  department: string;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

export const Instructor = sequelize.define<InstructorModel>(
  'Instructor',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: true },
    department: { type: DataTypes.STRING, allowNull: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { tableName: 'instructors', timestamps: true }
);
