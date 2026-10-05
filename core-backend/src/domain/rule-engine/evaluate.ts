/**
 * The evaluator: (rules × subjects) → outcomes.
 *
 * Pure and synchronous — no database, no I/O — so every decision can be
 * replayed and unit-tested from a fact snapshot. Each rule runs against every
 * subject of its scope; a rule whose condition is false produces a violation
 * carrying the interpolated message and the regulation it comes from.
 *
 * Fail-closed: a rule that references a missing fact or compares mismatched
 * types is reported with status `error` and, for error-severity rules, blocks
 * the request exactly like a violation would.
 */
import { applyOperator, UNARY_OPERATORS } from './operators';
import { interpolateText } from './interpolate';
import { resolvePath } from './resolve';
import {
  Condition,
  Evaluation,
  Facts,
  Operand,
  RuleDefinition,
  RuleOutcome,
  RuleParams,
  Subject,
  TraceNode,
} from './types';

function missingError(what: string): Error {
  const err = new Error(`missing ${what}`);
  err.name = 'RuleMissingError';
  return err;
}

function isReference(operand: Operand | undefined): operand is { fact: string } | { param: string } {
  return typeof operand === 'object' && operand !== null && !Array.isArray(operand);
}

function resolveOperand(operand: Operand | undefined, facts: Facts, params: RuleParams): unknown {
  if (!isReference(operand)) return operand;
  if ('fact' in operand) {
    const ref = resolvePath(facts, operand.fact);
    if (!ref.found) throw missingError(`fact "${operand.fact}"`);
    return ref.value;
  }
  if (!Object.prototype.hasOwnProperty.call(params, operand.param)) {
    throw missingError(`param "${operand.param}"`);
  }
  return params[operand.param];
}

/** Evaluates a condition tree and returns the full trace (every child is visited). */
export function evaluateCondition(condition: Condition, facts: Facts, params: RuleParams): TraceNode {
  if ('all' in condition) {
    const children = condition.all.map((c) => evaluateCondition(c, facts, params));
    return { kind: 'all', result: children.every((c) => c.result), children };
  }
  if ('any' in condition) {
    const children = condition.any.map((c) => evaluateCondition(c, facts, params));
    return { kind: 'any', result: children.some((c) => c.result), children };
  }
  if ('not' in condition) {
    const child = evaluateCondition(condition.not, facts, params);
    return { kind: 'not', result: !child.result, children: [child] };
  }

  const ref = resolvePath(facts, condition.fact);
  if (!ref.found) throw missingError(`fact "${condition.fact}"`);
  const expected = UNARY_OPERATORS.includes(condition.op) ? undefined : resolveOperand(condition.value, facts, params);
  return {
    kind: 'leaf',
    fact: condition.fact,
    op: condition.op,
    expected,
    actual: ref.value,
    result: applyOperator(condition.op, ref.value, expected),
  };
}

function evaluateRule(rule: RuleDefinition, subject: Subject, explain: boolean): RuleOutcome {
  const base = {
    rule: rule.code,
    severity: rule.severity,
    title: rule.title,
    subject: { kind: subject.kind, id: subject.id, label: subject.label },
    source: rule.source,
  };

  try {
    const whenTrace = rule.when ? evaluateCondition(rule.when, subject.facts, rule.params) : undefined;
    if (whenTrace && !whenTrace.result) {
      return { ...base, status: 'skipped', message: null, ...(explain ? { trace: { when: whenTrace } } : {}) };
    }
    const conditionTrace = evaluateCondition(rule.condition, subject.facts, rule.params);
    const passed = conditionTrace.result;
    return {
      ...base,
      status: passed ? 'passed' : 'failed',
      message: passed ? null : interpolateText(rule.message, subject.facts, rule.params),
      ...(explain ? { trace: { when: whenTrace, condition: conditionTrace } } : {}),
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      ...base,
      status: 'error',
      message: {
        mn: `«${rule.title.mn}» дүрмийг шалгаж чадсангүй (${detail}).`,
        en: `Rule “${rule.title.en}” could not be evaluated (${detail}).`,
      },
    };
  }
}

export interface EvaluateOptions {
  /** Include passed/skipped outcomes and condition traces (debugging, admin preview). */
  explain?: boolean;
}

/**
 * Runs every enabled rule against every subject of the rule's scope, in
 * priority order. `allowed` is false when any error-severity rule failed.
 */
export function evaluateRules(rules: RuleDefinition[], subjects: Subject[], options: EvaluateOptions = {}): Evaluation {
  const explain = options.explain ?? false;
  const active = rules
    .filter((r) => r.enabled)
    .sort((a, b) => a.priority - b.priority || a.code.localeCompare(b.code));

  const outcomes: RuleOutcome[] = [];
  for (const rule of active) {
    for (const subject of subjects) {
      if (subject.kind === rule.scope) outcomes.push(evaluateRule(rule, subject, explain));
    }
  }

  const failed = outcomes.filter((o) => o.status === 'failed' || o.status === 'error');
  const errors = failed.filter((o) => o.severity === 'error');
  return {
    allowed: errors.length === 0,
    errors,
    warnings: failed.filter((o) => o.severity === 'warning'),
    checked: outcomes.filter((o) => o.status !== 'skipped').length,
    ...(explain ? { outcomes } : {}),
  };
}
