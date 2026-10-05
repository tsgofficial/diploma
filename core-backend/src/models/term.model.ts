/**
 * Academic term (улирал). `phase` drives registration: `selection` =
 * Хичээл сонголт 1 (choose courses), `schedule` = Хичээл сонголт 2 (choose
 * class times and teachers). The window dates are informational; the phase
 * is switched by the registrar.
 */
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import type { TermType } from '../domain/academics/terms';

export type TermPhase = 'upcoming' | 'selection' | 'schedule' | 'in_progress' | 'closed';

export interface TermModel extends Model<InferAttributes<TermModel>, InferCreationAttributes<TermModel>> {
  id: CreationOptional<number>;
  code: string;
  type: TermType;
  year: number;
  /** Sortable: year·10 + order (winter 0, spring 1, summer 2, autumn 3). */
  seq: number;
  name: string;
  nameEn: string;
  phase: CreationOptional<TermPhase>;
  /** The term students are registering for right now. */
  isCurrent: CreationOptional<boolean>;
  selectionOpensAt: Date | null;
  selectionClosesAt: Date | null;
  scheduleOpensAt: Date | null;
  scheduleClosesAt: Date | null;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

export const Term = sequelize.define<TermModel>(
  'Term',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING(16), allowNull: false },
    type: { type: DataTypes.ENUM('winter', 'spring', 'summer', 'autumn'), allowNull: false },
    year: { type: DataTypes.INTEGER, allowNull: false },
    seq: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    nameEn: { type: DataTypes.STRING, allowNull: false, field: 'name_en' },
    phase: {
      type: DataTypes.ENUM('upcoming', 'selection', 'schedule', 'in_progress', 'closed'),
      allowNull: false,
      defaultValue: 'upcoming',
    },
    isCurrent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_current' },
    selectionOpensAt: { type: DataTypes.DATE, allowNull: true, field: 'selection_opens_at' },
    selectionClosesAt: { type: DataTypes.DATE, allowNull: true, field: 'selection_closes_at' },
    scheduleOpensAt: { type: DataTypes.DATE, allowNull: true, field: 'schedule_opens_at' },
    scheduleClosesAt: { type: DataTypes.DATE, allowNull: true, field: 'schedule_closes_at' },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { tableName: 'terms', timestamps: true, indexes: [{ unique: true, fields: ['code'] }, { fields: ['seq'] }] }
);
