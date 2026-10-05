/**
 * One block of a program's curriculum (ШУТИС тушаал №199, хүснэгт 8.1):
 * general / professional / specialization foundation, required or elective,
 * with the minimum credits a graduate must collect in it.
 */
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import type { CategoryGroup } from '../domain/academics/types';

export interface RequirementCategoryModel
  extends Model<InferAttributes<RequirementCategoryModel>, InferCreationAttributes<RequirementCategoryModel>> {
  id: CreationOptional<number>;
  programId: number;
  code: string;
  name: string;
  nameEn: string;
  group: CategoryGroup;
  isElective: boolean;
  minCredits: number;
  sortOrder: number;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

export const RequirementCategory = sequelize.define<RequirementCategoryModel>(
  'RequirementCategory',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    programId: { type: DataTypes.INTEGER, allowNull: false, field: 'program_id' },
    code: { type: DataTypes.STRING(32), allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    nameEn: { type: DataTypes.STRING, allowNull: false, field: 'name_en' },
    group: { type: DataTypes.ENUM('general', 'professional', 'specialization', 'open'), allowNull: false },
    isElective: { type: DataTypes.BOOLEAN, allowNull: false, field: 'is_elective' },
    minCredits: { type: DataTypes.INTEGER, allowNull: false, field: 'min_credits' },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    tableName: 'requirement_categories',
    timestamps: true,
    indexes: [{ unique: true, fields: ['program_id', 'code'] }],
  }
);
