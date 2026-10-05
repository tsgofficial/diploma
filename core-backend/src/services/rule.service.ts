/**
 * Registration rules: loading (with a short in-memory cache — every pick in
 * the registration peak needs them), admin edits (validated against the fact
 * catalog, audited), and the insert-only startup seed.
 */
import { ruleRepo } from '../repos/rule.repo';
import { auditRepo } from '../repos/audit.repo';
import { RegistrationRuleModel } from '../models/registrationRule.model';
import { FACT_CATALOG } from '../domain/registration/facts';
import { RuleDefinition, RulePhase, validateRule } from '../domain/rule-engine';
import { DEFAULT_RULES, RETIRED_RULES } from '../seed/rules.data';
import { createHttpError } from '../utils/httpError';

const CACHE_MS = 30_000;
let cache: { at: number; rules: RuleDefinition[] } | null = null;

export function toDefinition(row: RegistrationRuleModel): RuleDefinition {
  return {
    code: row.code,
    phase: row.phase,
    scope: row.scope,
    severity: row.severity,
    enabled: row.enabled,
    priority: row.priority,
    title: row.title,
    when: row.when,
    condition: row.condition,
    params: row.params ?? {},
    message: row.message,
    source: row.source,
  };
}

export function toRuleDto(row: RegistrationRuleModel) {
  return { ...toDefinition(row), description: row.description, updatedAt: row.updatedAt };
}

/** Fields an admin may change. The code and phase identify the rule and stay fixed. */
const EDITABLE = ['enabled', 'severity', 'priority', 'params', 'title', 'message', 'when', 'condition', 'source', 'scope'] as const;

export const ruleService = {
  async forPhase(phase: RulePhase): Promise<RuleDefinition[]> {
    if (!cache || Date.now() - cache.at > CACHE_MS) {
      const rows = await ruleRepo.list();
      cache = { at: Date.now(), rules: rows.map(toDefinition) };
    }
    return cache.rules.filter((r) => r.phase === phase);
  },

  invalidate(): void {
    cache = null;
  },

  async list(includeDisabled: boolean) {
    const rows = await ruleRepo.list();
    return rows.filter((r) => includeDisabled || r.enabled).map(toRuleDto);
  },

  /** PATCH a rule. The merged result must pass validation before it is saved. */
  async update(adminId: string, code: string, patch: Record<string, unknown>) {
    const row = await ruleRepo.findByCode(code);
    if (!row) throw createHttpError(404, 'rule not found');

    const unknown = Object.keys(patch).filter((k) => !(EDITABLE as readonly string[]).includes(k));
    if (unknown.length) throw createHttpError(400, `not editable: ${unknown.join(', ')}`);

    const merged = { ...toDefinition(row), ...patch };
    const problems = validateRule(merged, FACT_CATALOG);
    if (problems.length) throw createHttpError(422, 'invalid rule', { problems });

    const before = Object.fromEntries(Object.keys(patch).map((k) => [k, (row as unknown as Record<string, unknown>)[k]]));
    row.set({ ...patch, updatedBy: adminId } as Partial<RegistrationRuleModel>);
    await row.save();
    this.invalidate();
    await auditRepo.record({ userId: adminId, action: 'rule.update', target: code, meta: { before, after: patch } });
    return toRuleDto(row);
  },

  /** Startup: drop retired rules, add default rules that do not exist yet; never overwrite edits. */
  async ensureDefaults(): Promise<number> {
    if (await ruleRepo.removeCodes(RETIRED_RULES)) this.invalidate();
    const existing = new Set(await ruleRepo.codes());
    let created = 0;
    for (const seed of DEFAULT_RULES) {
      if (existing.has(seed.code)) continue;
      await ruleRepo.create({
        code: seed.code,
        phase: seed.phase,
        scope: seed.scope,
        severity: seed.severity,
        enabled: seed.enabled,
        priority: seed.priority,
        title: seed.title,
        description: seed.description,
        when: seed.when ?? null,
        condition: seed.condition,
        params: seed.params,
        message: seed.message,
        source: seed.source,
        updatedBy: null,
      });
      created += 1;
    }
    if (created) this.invalidate();
    return created;
  },
};
