/**
 * Structural validation of a rule definition before it is stored.
 *
 * Rules are edited as data, so a typo ("plan.totalCredit") must be rejected
 * at write time rather than discovered during registration. Every fact path
 * is checked against the catalog of facts the services actually provide for
 * that phase and scope.
 */
import { OPERATORS, UNARY_OPERATORS } from './operators';
import { placeholders } from './interpolate';
import { Condition, Operand, RulePhase, RuleScope } from './types';

/** Fact paths available to rules, per phase and scope. */
export type FactCatalog = Record<RulePhase, Partial<Record<RuleScope, readonly string[]>>>;

const PHASES: readonly RulePhase[] = ['selection', 'schedule'];
const SCOPES: readonly RuleScope[] = ['plan', 'course', 'section'];
const SEVERITIES = ['error', 'warning'];
const CODE_RE = /^[A-Z][A-Z0-9_]{2,40}$/;
const MAX_DEPTH = 8;
const MAX_NODES = 64;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isScalar(value: unknown): boolean {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function checkText(value: unknown, field: string, errors: string[]): void {
  if (!isObject(value) || typeof value.mn !== 'string' || typeof value.en !== 'string' || !value.mn.trim() || !value.en.trim()) {
    errors.push(`${field} must be { mn, en } with non-empty text`);
  }
}

interface WalkContext {
  facts: readonly string[];
  params: Record<string, unknown>;
  errors: string[];
  nodes: number;
}

function checkOperand(operand: unknown, path: string, ctx: WalkContext): void {
  if (isObject(operand)) {
    if (typeof operand.fact === 'string') {
      if (!ctx.facts.includes(operand.fact)) ctx.errors.push(`${path}: unknown fact "${operand.fact}"`);
    } else if (typeof operand.param === 'string') {
      if (!(operand.param in ctx.params)) ctx.errors.push(`${path}: unknown param "${operand.param}"`);
    } else {
      ctx.errors.push(`${path}: a reference must be { fact } or { param }`);
    }
    return;
  }
  if (Array.isArray(operand)) {
    if (!operand.every(isScalar)) ctx.errors.push(`${path}: list values must be text, numbers or booleans`);
    return;
  }
  if (!isScalar(operand)) ctx.errors.push(`${path}: invalid value`);
}

function checkCondition(node: unknown, path: string, depth: number, ctx: WalkContext): void {
  ctx.nodes += 1;
  if (ctx.nodes > MAX_NODES) {
    if (ctx.nodes === MAX_NODES + 1) ctx.errors.push(`condition has more than ${MAX_NODES} nodes`);
    return;
  }
  if (depth > MAX_DEPTH) {
    ctx.errors.push(`${path}: nested deeper than ${MAX_DEPTH} levels`);
    return;
  }
  if (!isObject(node)) {
    ctx.errors.push(`${path}: must be an object`);
    return;
  }
  for (const group of ['all', 'any'] as const) {
    if (group in node) {
      const list = node[group];
      if (!Array.isArray(list) || list.length === 0) ctx.errors.push(`${path}.${group}: must be a non-empty list`);
      else list.forEach((child, i) => checkCondition(child, `${path}.${group}[${i}]`, depth + 1, ctx));
      return;
    }
  }
  if ('not' in node) {
    checkCondition(node.not, `${path}.not`, depth + 1, ctx);
    return;
  }

  const leaf = node as Partial<Condition & { fact: string; op: string; value: Operand }>;
  if (typeof leaf.fact !== 'string') {
    ctx.errors.push(`${path}: expected all/any/not or a { fact, op, value } leaf`);
    return;
  }
  if (!ctx.facts.includes(leaf.fact)) ctx.errors.push(`${path}: unknown fact "${leaf.fact}"`);
  if (typeof leaf.op !== 'string' || !OPERATORS.includes(leaf.op as never)) {
    ctx.errors.push(`${path}: unknown operator "${String(leaf.op)}"`);
    return;
  }
  if (UNARY_OPERATORS.includes(leaf.op as never)) return;
  if (!('value' in leaf)) {
    ctx.errors.push(`${path}: operator "${leaf.op}" needs a value`);
    return;
  }
  checkOperand(leaf.value, `${path}.value`, ctx);
}

/** Returns a list of problems; an empty list means the rule can be stored. */
export function validateRule(input: unknown, catalog: FactCatalog): string[] {
  const errors: string[] = [];
  if (!isObject(input)) return ['rule must be an object'];

  if (typeof input.code !== 'string' || !CODE_RE.test(input.code)) errors.push('code must be UPPER_SNAKE_CASE (3–41 chars)');
  if (!PHASES.includes(input.phase as RulePhase)) errors.push(`phase must be one of ${PHASES.join(', ')}`);
  if (!SCOPES.includes(input.scope as RuleScope)) errors.push(`scope must be one of ${SCOPES.join(', ')}`);
  if (!SEVERITIES.includes(input.severity as string)) errors.push('severity must be error or warning');
  if (typeof input.enabled !== 'boolean') errors.push('enabled must be a boolean');
  if (!Number.isInteger(input.priority)) errors.push('priority must be an integer');
  checkText(input.title, 'title', errors);
  checkText(input.message, 'message', errors);

  const params = isObject(input.params) ? input.params : {};
  if (input.params !== undefined && !isObject(input.params)) errors.push('params must be an object');
  for (const [key, value] of Object.entries(params)) {
    const ok = isScalar(value) || (Array.isArray(value) && value.every(isScalar));
    if (!ok) errors.push(`params.${key} must be a scalar or a list of scalars`);
  }

  const facts = catalog[input.phase as RulePhase]?.[input.scope as RuleScope];
  if (PHASES.includes(input.phase as RulePhase) && SCOPES.includes(input.scope as RuleScope) && !facts) {
    errors.push(`scope "${String(input.scope)}" is not available in phase "${String(input.phase)}"`);
  }
  if (facts) {
    const ctx: WalkContext = { facts, params, errors, nodes: 0 };
    if (input.when !== undefined && input.when !== null) checkCondition(input.when, 'when', 1, ctx);
    if (input.condition === undefined) errors.push('condition is required');
    else checkCondition(input.condition, 'condition', 1, { ...ctx, nodes: 0 });

    if (isObject(input.message)) {
      for (const lang of ['mn', 'en'] as const) {
        const template = input.message[lang];
        if (typeof template !== 'string') continue;
        for (const key of placeholders(template)) {
          const known = key.startsWith('params.') ? key.slice('params.'.length) in params : facts.includes(key);
          if (!known) errors.push(`message.${lang}: unknown placeholder {${key}}`);
        }
      }
    }
  }

  if (input.source !== undefined && input.source !== null) {
    const s = input.source;
    if (!isObject(s) || typeof s.docTitle !== 'string' || !s.docTitle.trim()) errors.push('source.docTitle is required when source is set');
    else {
      if (s.clause !== undefined && s.clause !== null && typeof s.clause !== 'string') errors.push('source.clause must be text');
      if (s.page !== undefined && s.page !== null && !(Number.isInteger(s.page) && (s.page as number) > 0)) errors.push('source.page must be a positive integer');
    }
  }

  return errors;
}
