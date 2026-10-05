import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RULES } from '../../seed/rules.data';
import { evaluateRules, validateRule } from '../rule-engine';
import { summarizeAttempts } from '../academics/degreeAudit';
import { Attempt, CatalogCourse } from '../academics/types';
import { PERIODS } from '../scheduling/timeslot';
import {
  FACT_CATALOG,
  prerequisiteState,
  scheduleSubjects,
  ScheduleContext,
  SectionInfo,
  SelectionContext,
  selectionSubjects,
  StudentSnapshot,
} from './facts';

test('every default rule is valid against the fact catalog', () => {
  for (const rule of DEFAULT_RULES) {
    assert.deepEqual(validateRule(rule, FACT_CATALOG), [], `rule ${rule.code}`);
  }
});

test('default rule codes are unique', () => {
  const codes = DEFAULT_RULES.map((r) => r.code);
  assert.equal(new Set(codes).size, codes.length);
});

// ------------------------------------------------------------ fixtures ----

const text = (s: string) => ({ mn: s, en: s });
const course = (id: number, code: string, credits: number, prereqs: number[][] = [], extra: Partial<CatalogCourse> = {}): CatalogCourse => ({
  id,
  code,
  name: text(code),
  credits,
  isInternship: false,
  termsOffered: ['spring'],
  components: ['lecture', 'lab'],
  prerequisiteGroups: prereqs,
  tags: [],
  ...extra,
});

const courses = new Map(
  [
    course(1, 'CS202', 3),
    course(2, 'CS203', 3, [[1]]),
    course(3, 'CS204', 3, [[2]]),
    course(4, 'CS207', 3, [[2]]),
    course(5, 'CS206', 3),
    course(6, 'CS210', 3, [[1]]),
    course(7, 'SE315', 3, [[2, 1]]),
    course(8, 'ART101', 3),
    course(9, 'SE360', 3, [], { isInternship: true, termsOffered: ['summer'], components: [] }),
    course(10, 'BIG', 9),
  ].map((c) => [c.id, c])
);

const attempt = (courseId: number, letter: string, point: number, passed: boolean, status: Attempt['status'] = 'completed'): Attempt => ({
  courseId,
  termCode: '2026-spring',
  termSeq: 20261,
  letter,
  point,
  passed,
  status,
});

const student = (overrides: Partial<StudentSnapshot> = {}): StudentSnapshot => ({
  id: 1,
  code: 'B25',
  name: null,
  programId: 1,
  admissionYear: 2025,
  isDualProgram: false,
  semester: 4,
  year: 2,
  gpa: 3.1,
  earnedCredits: 45,
  lastTermGpa: 3.0,
  onWarning: false,
  warningCount: 0,
  ...overrides,
});

const selectionCtx = (attempts: Attempt[], overrides: Partial<SelectionContext> = {}): SelectionContext => ({
  student: student(),
  term: { id: 9, code: '2027-spring', type: 'spring' },
  courses,
  offered: new Set([1, 2, 3, 4, 5, 6, 7, 8, 10]),
  curriculum: new Map(
    [1, 2, 3, 4, 5, 6, 7, 9, 10].map((id) => [id, { courseId: id, categoryId: 1, recommendedSemester: 4, categoryCode: 'PROF_REQ', isElective: false }])
  ),
  records: summarizeAttempts(attempts),
  ...overrides,
});

const codes = (list: { rule: string }[]) => list.map((o) => o.rule).sort();
// Services evaluate only the rules of the current phase.
const SELECTION_RULES = DEFAULT_RULES.filter((r) => r.phase === 'selection');
const SCHEDULE_RULES = DEFAULT_RULES.filter((r) => r.phase === 'schedule');

// ------------------------------------------------- Хичээл сонголт 1 ----

test('prerequisite state: met, pending, missing and OR groups', () => {
  const ctx = selectionCtx([attempt(1, 'B', 3, true), attempt(2, '', 0, false, 'in_progress')]);
  assert.equal(prerequisiteState(ctx, courses.get(2)!).status, 'met');
  assert.deepEqual(prerequisiteState(ctx, courses.get(3)!), { status: 'pending', missing: [], pending: ['CS203'] });
  assert.equal(prerequisiteState(ctx, courses.get(7)!).status, 'met'); // CS203 or CS202 — CS202 passed
  const fresh = selectionCtx([]);
  assert.deepEqual(prerequisiteState(fresh, courses.get(7)!).missing, ['CS203/CS202']);
});

test('a clean plan passes every selection rule', () => {
  const ctx = selectionCtx([attempt(1, 'B', 3, true), attempt(2, 'B', 3, true)]);
  const result = evaluateRules(SELECTION_RULES, selectionSubjects(ctx, [3, 4, 5, 6]));
  assert.equal(result.allowed, true);
  assert.deepEqual(result.warnings, []);
});

test('a missing prerequisite blocks with the clause 8.6 citation', () => {
  const ctx = selectionCtx([attempt(1, 'B', 3, true), attempt(2, 'F', 0.5, false)]);
  const result = evaluateRules(SELECTION_RULES, selectionSubjects(ctx, [3]));
  assert.equal(result.allowed, false);
  assert.deepEqual(codes(result.errors), ['PREREQUISITES']);
  assert.equal(result.errors[0].source?.clause, '8.6');
  assert.match(result.errors[0].message!.en, /Missing: CS203/);
});

test('a prerequisite still in progress only warns', () => {
  const ctx = selectionCtx([attempt(1, 'B', 3, true), attempt(2, '', 0, false, 'in_progress')]);
  const result = evaluateRules(SELECTION_RULES, selectionSubjects(ctx, [3]));
  assert.equal(result.allowed, true);
  assert.ok(codes(result.warnings).includes('PREREQ_IN_PROGRESS'));
});

test('22 credits in a main semester breaks the 21-credit limit (9.6)', () => {
  const ctx = selectionCtx([attempt(1, 'B', 3, true), attempt(2, 'B', 3, true)]);
  const result = evaluateRules(SELECTION_RULES, selectionSubjects(ctx, [3, 4, 5, 6, 10, 8])); // 3·5 + 9 = 24
  assert.deepEqual(codes(result.errors), ['MAX_CREDITS_MAIN']);
});

test('internships do not count toward the load', () => {
  const ctx = selectionCtx([attempt(1, 'B', 3, true), attempt(2, 'B', 3, true)]);
  const subjects = selectionSubjects(ctx, [3, 4, 5, 6, 10, 9]); // 21 + internship 3
  const plan = subjects[0].facts.plan as { loadCredits: number; totalCredits: number };
  assert.equal(plan.totalCredits, 24);
  assert.equal(plan.loadCredits, 21);
  assert.ok(!codes(evaluateRules(SELECTION_RULES, subjects).errors).includes('MAX_CREDITS_MAIN'));
});

test('a minor/double-program student gets the 30-credit limit (9.7)', () => {
  const ctx = selectionCtx([attempt(1, 'B', 3, true), attempt(2, 'B', 3, true)], { student: student({ isDualProgram: true }) });
  const result = evaluateRules(SELECTION_RULES, selectionSubjects(ctx, [3, 4, 5, 6, 10, 8]));
  assert.equal(result.allowed, true);
});

test('retaking a well-passed course is blocked, a D can be improved', () => {
  const good = selectionCtx([attempt(1, 'A', 3.7, true)]);
  assert.deepEqual(codes(evaluateRules(SELECTION_RULES, selectionSubjects(good, [1])).errors), ['ALREADY_PASSED']);
  const weak = selectionCtx([attempt(1, 'D', 1.3, true)]);
  assert.equal(evaluateRules(SELECTION_RULES, selectionSubjects(weak, [1])).allowed, true);
});

test('a course outside the curriculum is allowed with a warning', () => {
  const ctx = selectionCtx([]);
  const result = evaluateRules(SELECTION_RULES, selectionSubjects(ctx, [8, 1, 5, 10]));
  assert.equal(result.allowed, true);
  assert.deepEqual(codes(result.warnings), ['IN_CURRICULUM']);
});

test('academic warning (10.21) suggests a lighter load', () => {
  const ctx = selectionCtx([attempt(1, 'B', 3, true), attempt(2, 'B', 3, true)], {
    student: student({ onWarning: true, lastTermGpa: 0.9 }),
  });
  const result = evaluateRules(SELECTION_RULES, selectionSubjects(ctx, [3, 4, 5, 6, 7, 8])); // 18 credits
  assert.ok(codes(result.warnings).includes('ACADEMIC_WARNING_LOAD'));
  assert.match(result.warnings.find((w) => w.rule === 'ACADEMIC_WARNING_LOAD')!.message!.en, /0\.90/);
});

test('a course not offered this term is blocked', () => {
  const ctx = selectionCtx([], { offered: new Set([1]) });
  assert.deepEqual(codes(evaluateRules(SELECTION_RULES, selectionSubjects(ctx, [5])).errors), ['OFFERED_THIS_TERM']);
});

// ------------------------------------------------- Хичээл сонголт 2 ----

const at = (day: number, period: number, weekParity: 'all' | 'odd' | 'even' = 'all') => ({
  dayOfWeek: day,
  startMinute: PERIODS[period - 1].start,
  endMinute: PERIODS[period - 1].end,
  weekParity,
});
const sec = (id: number, courseId: number, type: SectionInfo['type'], meetings: ReturnType<typeof at>[]): SectionInfo => ({
  id,
  label: `S${id}`,
  code: `${type[0].toUpperCase()}${id}`,
  type,
  courseId,
  instructor: { id: 1, name: 'Б.Болд', title: null },
  meetings,
});

const scheduleCtx = (overrides: Partial<ScheduleContext> = {}): ScheduleContext => ({
  student: student(),
  term: { id: 9, code: '2027-spring', type: 'spring' },
  courses,
  selected: [3, 4],
  sections: new Map(
    [
      sec(101, 3, 'lecture', [at(1, 3)]),
      sec(102, 3, 'lab', [at(2, 2)]),
      sec(103, 3, 'lab', [at(4, 5, 'odd')]),
      sec(201, 4, 'lecture', [at(3, 3)]),
      sec(202, 4, 'lab', [at(4, 5, 'even')]),
      sec(203, 4, 'lab', [at(1, 3)]), // clashes with 101
      sec(301, 5, 'lecture', [at(5, 1)]),
    ].map((s) => [s.id, s])
  ),
  held: new Set(),
  ...overrides,
});

test('a complete conflict-free timetable passes', () => {
  const ctx = scheduleCtx();
  const result = evaluateRules(SCHEDULE_RULES, scheduleSubjects(ctx, [101, 103, 201, 202]));
  assert.equal(result.allowed, true);
  assert.deepEqual(result.warnings, []); // odd/even labs at Thu-5 do not clash
});

test('picking a clashing section is refused with the clash named', () => {
  const ctx = scheduleCtx();
  const result = evaluateRules(SCHEDULE_RULES, scheduleSubjects(ctx, [101, 103, 201], [203]));
  assert.deepEqual(codes(result.errors), ['TIME_CONFLICT']);
  assert.match(result.errors[0].message!.en, /CS204/);
});

test('swapping within a component ignores the section being replaced', () => {
  const ctx = scheduleCtx();
  // 102 (Tue-2) replaces 103 for CS204's lab: no self-clash although both are labs of course 3.
  const result = evaluateRules(SCHEDULE_RULES, scheduleSubjects(ctx, [101, 103, 201, 202], [102]));
  assert.equal(result.allowed, true);
});

test('sections of a course not chosen in Selection 1 are refused', () => {
  const result = evaluateRules(SCHEDULE_RULES, scheduleSubjects(scheduleCtx(), [101], [301]));
  assert.deepEqual(codes(result.errors), ['COURSE_SELECTED']);
});

test('missing components produce a localized warning', () => {
  const result = evaluateRules(SCHEDULE_RULES, scheduleSubjects(scheduleCtx(), [101, 201]));
  const warnings = result.warnings.filter((w) => w.rule === 'COMPONENTS_COMPLETE');
  assert.equal(warnings.length, 2);
  assert.equal(warnings[0].message!.mn, 'CS204: лаборатори цагаа сонгоогүй байна.');
});
