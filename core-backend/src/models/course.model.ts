/**
 * Course catalog entry. The code's number follows хүснэгт 8.1 (100–199
 * general, 200–299 professional, 300–499 specialization). `components` are
 * the section types a student must pick in Хичээл сонголт 2 (8.8).
 */
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import type { SectionType } from '../domain/academics/types';
import type { TermType } from '../domain/academics/terms';

export interface CourseModel extends Model<InferAttributes<CourseModel>, InferCreationAttributes<CourseModel>> {
  id: CreationOptional<number>;
  code: string;
  name: string;
  nameEn: string;
  credits: number;
  department: string;
  isInternship: CreationOptional<boolean>;
  components: SectionType[];
  termsOffered: TermType[];
  /** Interest tags for elective recommendations, e.g. ["ai_data"]. */
  tags: CreationOptional<string[]>;
  description: string | null;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

export const Course = sequelize.define<CourseModel>(
  'Course',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING(16), allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    nameEn: { type: DataTypes.STRING, allowNull: false, field: 'name_en' },
    credits: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0, max: 30 } },
    department: { type: DataTypes.STRING, allowNull: false },
    isInternship: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_internship' },
    components: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    termsOffered: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'terms_offered' },
    tags: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    description: { type: DataTypes.TEXT, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { tableName: 'courses', timestamps: true, indexes: [{ unique: true, fields: ['code'] }] }
);
