/**
 * Weekly meeting of a section: weekday, time range (minutes after midnight)
 * and week parity (every / odd / even week).
 */
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import type { WeekParity } from '../domain/scheduling/timeslot';

export interface SectionMeetingModel
  extends Model<InferAttributes<SectionMeetingModel>, InferCreationAttributes<SectionMeetingModel>> {
  id: CreationOptional<number>;
  sectionId: number;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  weekParity: CreationOptional<WeekParity>;
  room: string | null;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

export const SectionMeeting = sequelize.define<SectionMeetingModel>(
  'SectionMeeting',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    sectionId: { type: DataTypes.INTEGER, allowNull: false, field: 'section_id' },
    dayOfWeek: { type: DataTypes.INTEGER, allowNull: false, field: 'day_of_week', validate: { min: 1, max: 7 } },
    startMinute: { type: DataTypes.INTEGER, allowNull: false, field: 'start_minute', validate: { min: 0, max: 1439 } },
    endMinute: { type: DataTypes.INTEGER, allowNull: false, field: 'end_minute', validate: { min: 1, max: 1440 } },
    weekParity: { type: DataTypes.ENUM('all', 'odd', 'even'), allowNull: false, defaultValue: 'all', field: 'week_parity' },
    room: { type: DataTypes.STRING(32), allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    tableName: 'section_meetings',
    timestamps: true,
    indexes: [{ fields: ['section_id'] }],
    validate: {
      endsAfterStart(this: SectionMeetingModel) {
        if (this.endMinute <= this.startMinute) throw new Error('a meeting must end after it starts');
      },
    },
  }
);
