import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRules, evaluateCondition } from './evaluate';
import { interpolate } from './interpolate';
import { validateRule, FactCatalog } from './validate';
import { RuleDefinition, Subject } from './types';

const text = (s: string) => ({ mn: s, en: s });

function rule(overrides: Partial<RuleDefinition>): RuleDefinition {
  return {
    code: 'TEST_RULE',
    phase: 'selection',
    scope: 'plan',
    severity: 'error',
    enabled: true,
    priority: 10,
    title: text('Test rule'),
    condition: { fact: 'plan.loadCredits', op: 'lte', value: { param: 'max' } },
    params: { max: 21 },
    message: text('{plan.loadCredits} > {params.max}'),
    source: { docTitle: 'ШУТИС тушаал №199 (2025-06-06)', clause: '9.6', page: 15 },
    ...overrides,
  };
}

const plan = (loadCredits: number, extra: Record<string, unknown> = {}): Subject => ({
  kind: 'plan',
  facts: { term: { type: 'spring', isMain: true }, student: { isDualProgram: false, onWarning: false }, plan: { loadCredits, ...extra } },
});

test('a satisfied rule produces no violations', () => {
  const result = evaluateRules([rule({})], [plan(18)]);
  assert.equal(result.allowed, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.checked, 1);
});

test('a violated error rule blocks and carries the interpolated message and source', () => {
  const result = evaluateRules([rule({})], [plan(24)]);
  assert.equal(result.allowed, false);
  assert.equal(result.errors[0].message?.en, '24 > 21');
  assert.equal(result.errors[0].source?.clause, '9.6');
});

test('changing a param changes the decision without touching code', () => {
  const strict = rule({ params: { max: 15 } });
  assert.equal(evaluateRules([strict], [plan(18)]).allowed, false);
  assert.equal(evaluateRules([rule({})], [plan(18)]).allowed, true);
});

test('a violated warning rule is reported but does not block', () => {
  const result = evaluateRules([rule({ severity: 'warning' })], [plan(24)]);
  assert.equal(result.allowed, true);
  assert.equal(result.warnings.length, 1);
});

test('disabled rules are ignored', () => {
  const result = evaluateRules([rule({ enabled: false })], [plan(99)]);
  assert.equal(result.allowed, true);
  assert.equal(result.checked, 0);
});

test('`when` skips a rule that does not apply', () => {
  const winterOnly = rule({ when: { fact: 'term.type', op: 'eq', value: 'winter' }, params: { max: 3 } });
  const result = evaluateRules([winterOnly], [plan(18)], { explain: true });
  assert.equal(result.allowed, true);
  assert.equal(result.outcomes?.[0].status, 'skipped');
});

test('rules only run against subjects of their scope', () => {
  const courseRule = rule({ scope: 'course', condition: { fact: 'course.offered', op: 'eq', value: true } });
  const subjects: Subject[] = [
    plan(10),
    { kind: 'course', id: 1, label: 'CS201', facts: { course: { offered: true } } },
    { kind: 'course', id: 2, label: 'CS999', facts: { course: { offered: false } } },
  ];
  const result = evaluateRules([courseRule], subjects);
  assert.equal(result.checked, 2);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].subject.id, 2);
});

test('all / any / not combine as boolean logic', () => {
  const facts = { a: { x: 5, list: ['CS201', 'CS202'], name: 'Data' } };
  const cond = {
    all: [
      { fact: 'a.x', op: 'gte' as const, value: 5 },
      { any: [{ fact: 'a.list', op: 'contains' as const, value: 'CS999' }, { fact: 'a.name', op: 'contains' as const, value: 'at' }] },
      { not: { fact: 'a.list', op: 'isEmpty' as const } },
    ],
  };
  assert.equal(evaluateCondition(cond, facts, {}).result, true);
  assert.equal(evaluateCondition({ not: cond }, facts, {}).result, false);
});

test('operands can reference other facts', () => {
  const cond = { fact: 'plan.loadCredits', op: 'lte' as const, value: { fact: 'student.maxCredits' } };
  assert.equal(evaluateCondition(cond, { plan: { loadCredits: 20 }, student: { maxCredits: 21 } }, {}).result, true);
  assert.equal(evaluateCondition(cond, { plan: { loadCredits: 22 }, student: { maxCredits: 21 } }, {}).result, false);
});

test('in / notIn / isEmpty / notEmpty', () => {
  const facts = { t: { type: 'summer', missing: [] as string[], codes: ['A'] } };
  assert.equal(evaluateCondition({ fact: 't.type', op: 'in', value: ['winter', 'summer'] }, facts, {}).result, true);
  assert.equal(evaluateCondition({ fact: 't.type', op: 'notIn', value: ['winter', 'summer'] }, facts, {}).result, false);
  assert.equal(evaluateCondition({ fact: 't.missing', op: 'isEmpty' }, facts, {}).result, true);
  assert.equal(evaluateCondition({ fact: 't.codes', op: 'notEmpty' }, facts, {}).result, true);
});

test('fail-closed: a missing fact turns an error rule into a blocking error outcome', () => {
  const broken = rule({ condition: { fact: 'plan.totalCredit', op: 'lte', value: 21 } });
  const result = evaluateRules([broken], [plan(10)]);
  assert.equal(result.allowed, false);
  assert.match(result.errors[0].message?.en ?? '', /could not be evaluated.*plan\.totalCredit/);
});

test('fail-closed: comparing a text fact with lte is an error, not a silent pass', () => {
  const broken = rule({ condition: { fact: 'term.type', op: 'lte', value: 21 } });
  const result = evaluateRules([broken], [plan(10)]);
  assert.equal(result.allowed, false);
  assert.equal(result.errors[0].status, 'error');
});

test('explain mode returns traces with actual and expected values', () => {
  const result = evaluateRules([rule({})], [plan(24)], { explain: true });
  const trace = result.outcomes?.[0].trace?.condition;
  assert.equal(trace?.actual, 24);
  assert.equal(trace?.expected, 21);
  assert.equal(trace?.result, false);
});

test('rules run in priority order', () => {
  const a = rule({ code: 'B_RULE', priority: 20 });
  const b = rule({ code: 'A_RULE', priority: 10 });
  const result = evaluateRules([a, b], [plan(30)]);
  assert.deepEqual(result.errors.map((e) => e.rule), ['A_RULE', 'B_RULE']);
});

test('interpolation formats lists, decimals and missing values', () => {
  const facts = { course: { missing: ['CS203', 'MATH104'], gpa: 2.456, none: null } };
  assert.equal(interpolate('{course.missing}', facts, {}), 'CS203, MATH104');
  assert.equal(interpolate('{course.gpa}', facts, {}), '2.46');
  assert.equal(interpolate('{course.none}/{params.max}', facts, { max: 21 }), '—/21');
});

const catalog: FactCatalog = {
  selection: { plan: ['plan.loadCredits', 'term.type'], course: ['course.offered', 'course.code'] },
  schedule: { plan: ['student.onWarning'] },
};

test('validation accepts a well-formed rule', () => {
  assert.deepEqual(validateRule(rule({ condition: { fact: 'plan.loadCredits', op: 'lte', value: { param: 'max' } } }), catalog), []);
});

test('validation rejects unknown facts, params, operators and placeholders', () => {
  const errors = validateRule(
    {
      ...rule({}),
      condition: { all: [{ fact: 'plan.totalCredit', op: 'lte', value: { param: 'maximum' } }, { fact: 'term.type', op: 'like', value: 'x' }] },
      message: text('{course.code} {params.nope}'),
    },
    catalog
  );
  assert.ok(errors.some((e) => e.includes('unknown fact "plan.totalCredit"')));
  assert.ok(errors.some((e) => e.includes('unknown param "maximum"')));
  assert.ok(errors.some((e) => e.includes('unknown operator "like"')));
  assert.ok(errors.some((e) => e.includes('{course.code}')));
  assert.ok(errors.some((e) => e.includes('{params.nope}')));
});

test('validation rejects a scope the phase does not provide', () => {
  const errors = validateRule({ ...rule({}), phase: 'schedule', scope: 'section' }, catalog);
  assert.ok(errors.some((e) => e.includes('not available')));
});

test('validation bounds the size of a condition tree', () => {
  const leaf = { fact: 'plan.loadCredits', op: 'gt', value: 0 };
  const huge = { any: Array.from({ length: 100 }, () => leaf) };
  const errors = validateRule({ ...rule({}), condition: huge }, catalog);
  assert.ok(errors.some((e) => e.includes('more than')));
});
