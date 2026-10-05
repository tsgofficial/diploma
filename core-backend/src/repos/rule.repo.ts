/**
 * Data access for registration rules.
 */
import { InferCreationAttributes } from 'sequelize';
import { RegistrationRule, RegistrationRuleModel } from '../models/registrationRule.model';
import type { RulePhase } from '../domain/rule-engine/types';

export const ruleRepo = {
  async list(phase?: RulePhase): Promise<RegistrationRuleModel[]> {
    return RegistrationRule.findAll({
      where: phase ? { phase } : {},
      order: [['phase', 'ASC'], ['priority', 'ASC'], ['code', 'ASC']],
    });
  },

  async findByCode(code: string): Promise<RegistrationRuleModel | null> {
    return RegistrationRule.findOne({ where: { code } });
  },

  async removeCodes(codes: string[]): Promise<number> {
    return RegistrationRule.destroy({ where: { code: codes } });
  },

  async codes(): Promise<string[]> {
    const rows = await RegistrationRule.findAll({ attributes: ['code'] });
    return rows.map((r) => r.code);
  },

  async create(
    values: Omit<InferCreationAttributes<RegistrationRuleModel>, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<RegistrationRuleModel> {
    return RegistrationRule.create(values);
  },
};
