/**
 * Student record, one per user account that studies (оюутан). The user row
 * holds login and name; this row holds the academic identity. It is also the
 * row locked (SELECT … FOR UPDATE) to serialise one student's registration
 * requests.
 */
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export interface StudentModel extends Model<InferAttributes<StudentModel>, InferCreationAttributes<StudentModel>> {
  id: CreationOptional<number>;
  userId: string;
  studentCode: string;
  programId: number;
  admissionYear: number;
  /** Also enrolled in a minor / double / joint program — 30-credit cap (9.7). */
  isDualProgram: CreationOptional<boolean>;
  status: CreationOptional<'active' | 'inactive' | 'graduated'>;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

export const Student = sequelize.define<StudentModel>(
  'Student',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
    studentCode: { type: DataTypes.STRING(16), allowNull: false, field: 'student_code' },
    programId: { type: DataTypes.INTEGER, allowNull: false, field: 'program_id' },
    admissionYear: { type: DataTypes.INTEGER, allowNull: false, field: 'admission_year' },
    isDualProgram: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_dual_program' },
    status: { type: DataTypes.ENUM('active', 'inactive', 'graduated'), allowNull: false, defaultValue: 'active' },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    tableName: 'students',
    timestamps: true,
    indexes: [{ unique: true, fields: ['user_id'] }, { unique: true, fields: ['student_code'] }],
  }
);
