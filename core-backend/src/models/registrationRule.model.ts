/**
 * A registration rule stored as data (see domain/rule-engine). The condition
 * tree, params and messages are JSONB so the registrar can change a limit or
 * switch a rule off without a deployment; every write is validated against
 * the fact catalog first.
 */
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import type {
  Condition,
  LocalizedText,
  RuleParams,
  RulePhase,
  RuleScope,
  RuleSource,
  Severity,
} from '../domain/rule-engine/types';

export interface RegistrationRuleModel
  extends Model<InferAttributes<RegistrationRuleModel>, InferCreationAttributes<RegistrationRuleModel>> {
  id: CreationOptional<number>;
  code: string;
  phase: RulePhase;
  scope: RuleScope;
  severity: Severity;
  enabled: boolean;
  priority: number;
  title: LocalizedText;
  description: LocalizedText | null;
  when: Condition | null;
  condition: Condition;
  params: RuleParams;
  message: LocalizedText;
  source: RuleSource | null;
  updatedBy: string | null;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

export const RegistrationRule = sequelize.define<RegistrationRuleModel>(
  'RegistrationRule',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING(48), allowNull: false },
    phase: { type: DataTypes.ENUM('selection', 'schedule'), allowNull: false },
    scope: { type: DataTypes.ENUM('plan', 'course', 'section'), allowNull: false },
    severity: { type: DataTypes.ENUM('error', 'warning'), allowNull: false },
    enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
    title: { type: DataTypes.JSONB, allowNull: false },
    description: { type: DataTypes.JSONB, allowNull: true },
    when: { type: DataTypes.JSONB, allowNull: true },
    condition: { type: DataTypes.JSONB, allowNull: false },
    params: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    message: { type: DataTypes.JSONB, allowNull: false },
    source: { type: DataTypes.JSONB, allowNull: true },
    updatedBy: { type: DataTypes.UUID, allowNull: true, field: 'updated_by' },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { tableName: 'registration_rules', timestamps: true, indexes: [{ unique: true, fields: ['code'] }] }
);
