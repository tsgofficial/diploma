/**
 * Study program (хөтөлбөр), e.g. "Программ хангамж". Its curriculum is the
 * set of requirement categories plus the courses mapped into them.
 */
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export interface ProgramModel extends Model<InferAttributes<ProgramModel>, InferCreationAttributes<ProgramModel>> {
  id: CreationOptional<number>;
  code: string;
  name: string;
  nameEn: string;
  school: string;
  degree: CreationOptional<string>;
  totalCredits: number;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

export const Program = sequelize.define<ProgramModel>(
  'Program',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING(32), allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    nameEn: { type: DataTypes.STRING, allowNull: false, field: 'name_en' },
    school: { type: DataTypes.STRING, allowNull: false },
    degree: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'bachelor' },
    totalCredits: { type: DataTypes.INTEGER, allowNull: false, field: 'total_credits' },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { tableName: 'programs', timestamps: true, indexes: [{ unique: true, fields: ['code'] }] }
);
