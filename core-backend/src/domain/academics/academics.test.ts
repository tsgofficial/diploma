import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bandForScore, computeGpa, isPassingLetter, pointForLetter } from './grading';
import { nextMainTerm, nextTerm, parseTermCode, semesterNumber, termSeq } from './terms';
import { auditDegree } from './degreeAudit';
import { findCycles, planGraduation, PlanPreferences } from './planner';
import { Attempt, CatalogCourse, CurriculumEntry, RequirementCategory } from './types';
import type { TermType } from './terms';

// ------------------------------------------------------------ grading ----

test('score → letter follows хүснэгт 10.2', () => {
  assert.equal(bandForScore(95).letter, 'A+');
  assert.equal(bandForScore(94).letter, 'A');
  assert.equal(bandForScore(77).letter, 'C+');
  assert.equal(bandForScore(60).letter, 'D-');
  assert.equal(bandForScore(59).letter, 'F');
});

test('pass threshold is D- (60 points)', () => {
  assert.equal(isPassingLetter('D-'), true);
  assert.equal(isPassingLetter('F'), false);
  assert.equal(isPassingLetter('WF'), false);
  assert.equal(pointForLetter('W'), null);
});

test('GPA is credit-weighted (10.17) and ignores W', () => {
  assert.equal(computeGpa([{ credits: 3, point: 4 }, { credits: 1, point: 2 }]), 3.5);
  assert.equal(computeGpa([{ credits: 3, point: null }]), null);
});

// -------------------------------------------------------------- terms ----

test('term order and semester numbers', () => {
  assert.ok(termSeq(parseTermCode('2026-autumn')) < termSeq(parseTermCode('2027-spring')));
  assert.deepEqual(nextTerm({ year: 2026, type: 'autumn' }), { year: 2027, type: 'winter' });
  assert.deepEqual(nextMainTerm({ year: 2026, type: 'autumn' }), { year: 2027, type: 'spring' });
  // Admitted autumn 2025: 2025A=1, 2026S=2, 2026A=3, 2027S=4.
  assert.equal(semesterNumber(2025, { year: 2027, type: 'spring' }), 4);
});

// ----------------------------------------------------- fixture program ----

const text = (s: string) => ({ mn: s, en: s });
function course(id: number, code: string, credits: number, terms: TermType[], prereqs: number[][] = [], isInternship = false, tags: string[] = []): CatalogCourse {
  return { id, code, name: text(code), credits, isInternship, termsOffered: terms, components: ['lecture'], prerequisiteGroups: prereqs, tags };
}

const courses = new Map<number, CatalogCourse>(
  [
    course(1, 'CS201', 3, ['autumn']),
    course(2, 'CS202', 3, ['spring'], [[1]]),
    course(3, 'CS203', 3, ['autumn'], [[2]]),
    course(4, 'CS204', 3, ['spring'], [[3]]),
    course(5, 'MATH101', 3, ['autumn', 'spring']),
    course(10, 'EL1', 3, ['autumn', 'spring', 'summer']),
    course(11, 'EL2', 3, ['spring'], [[2, 5]]), // CS202 or MATH101
    course(12, 'EL3', 3, ['autumn'], [], false, ['ai']),
    course(20, 'SE360', 3, ['summer'], [[2]], true),
    course(30, 'ART101', 3, ['autumn', 'spring', 'summer']),
  ].map((c) => [c.id, c])
);

const categories: RequirementCategory[] = [
  { id: 1, code: 'CORE', name: text('Core'), group: 'professional', isElective: false, minCredits: 15, sortOrder: 1 },
  { id: 2, code: 'ELEC', name: text('Elective'), group: 'professional', isElective: true, minCredits: 6, sortOrder: 2 },
  { id: 3, code: 'INTERN', name: text('Internship'), group: 'specialization', isElective: false, minCredits: 3, sortOrder: 3 },
  { id: 4, code: 'OPEN', name: text('Open'), group: 'open', isElective: true, minCredits: 3, sortOrder: 4 },
];

const curriculum: CurriculumEntry[] = [
  { courseId: 1, categoryId: 1, recommendedSemester: 1 },
  { courseId: 2, categoryId: 1, recommendedSemester: 2 },
  { courseId: 3, categoryId: 1, recommendedSemester: 3 },
  { courseId: 4, categoryId: 1, recommendedSemester: 4 },
  { courseId: 5, categoryId: 1, recommendedSemester: 1 },
  { courseId: 10, categoryId: 2, recommendedSemester: 2 },
  { courseId: 11, categoryId: 2, recommendedSemester: 3 },
  { courseId: 12, categoryId: 2, recommendedSemester: 3 },
  { courseId: 20, categoryId: 3, recommendedSemester: 4 },
];

let seq = 0;
const done = (courseId: number, letter: string, point: number, passed = true): Attempt => ({
  courseId,
  termCode: '2025-autumn',
  termSeq: 20253 + seq++,
  letter,
  point,
  passed,
  status: 'completed',
});
const taking = (courseId: number): Attempt => ({ courseId, termCode: '2026-autumn', termSeq: 20263, letter: null, point: null, passed: false, status: 'in_progress' });

const audit = (attempts: Attempt[], planned: number[] = []) =>
  auditDegree({ totalCredits: 27, categories, curriculum, courses, attempts, planned });

// -------------------------------------------------------------- audit ----

test('audit pours credits into categories and lists missing required courses', () => {
  const result = audit([done(1, 'A', 3.7), done(5, 'B', 3.0), done(10, 'C', 2.0)], [2]);
  const core = result.categories.find((c) => c.code === 'CORE')!;
  assert.equal(core.earned, 6);
  assert.equal(core.planned, 3);
  assert.deepEqual(core.courses.filter((c) => c.state === 'missing').map((c) => c.code), ['CS203', 'CS204']);
  assert.equal(result.totals.earned, 9);
  assert.equal(result.gpa, 2.9); // (3.7·3 + 3·3 + 2·3) / 9
});

test('a retaken course counts once with its best grade', () => {
  const result = audit([done(1, 'F', 0.5, false), done(1, 'B', 3.0)]);
  assert.equal(result.records.get(1)?.attempts, 2);
  assert.equal(result.gpa, 3.0);
  assert.equal(result.categories[0].earned, 3);
});

test('a failed course earns nothing', () => {
  const result = audit([done(1, 'F', 0.5, false)]);
  assert.equal(result.totals.earned, 0);
  assert.equal(result.records.get(1)?.passed, false);
});

test('elective overflow goes to open electives, then to extra credits', () => {
  const result = audit([done(10, 'A', 3.7), done(11, 'A', 3.7), done(12, 'A', 3.7), done(30, 'A', 3.7)]);
  const elec = result.categories.find((c) => c.code === 'ELEC')!;
  const open = result.categories.find((c) => c.code === 'OPEN')!;
  assert.equal(elec.earned, 6);
  assert.equal(open.earned, 3);
  assert.equal(result.extraCredits, 3);
});

test('in-progress courses count toward the projection, not the earned total', () => {
  const result = audit([done(1, 'A', 3.7), taking(2)]);
  const core = result.categories[0];
  assert.equal(core.earned, 3);
  assert.equal(core.inProgress, 3);
  assert.equal(core.projectedRemaining, 9);
});

// ------------------------------------------------------------ planner ----
// Admitted autumn 2026, registering for spring 2027 = semester 2. Passed CS201 and MATH101.
// Remaining chain CS202 (spring) → CS203 (autumn) → CS204 (spring): semester 4 at the earliest.

const base = [done(1, 'A', 3.7), done(5, 'A', 3.7)];
const prefs = (over: Partial<PlanPreferences> = {}): PlanPreferences => ({
  targetSemesters: null,
  allowSummer: false,
  maxLoad: 9,
  lightSemesters: [],
  interests: [],
  keepSelection: true,
  ...over,
});
const plan = (over: Partial<PlanPreferences> = {}, planned: number[] = [], limits = { hardMax: 12, summerMax: 6 }) =>
  planGraduation({
    courses,
    categories,
    curriculum,
    audit: audit(base, planned),
    planned,
    startTerm: parseTermCode('2027-spring'),
    startSemester: 2,
    prefs: prefs(over),
    limits,
    openPool: [30],
    standardSemesters: 8,
  });
const termOf = (result: ReturnType<typeof plan>, id: number) => result.terms.find((t) => t.courseIds.includes(id));

test('the plan respects prerequisites, term offerings and the load cap', () => {
  const result = plan();
  const index = new Map<number, number>();
  result.terms.forEach((t, i) => t.courseIds.forEach((id) => index.set(id, i)));
  for (const id of result.targets) {
    for (const group of courses.get(id)!.prerequisiteGroups) {
      const ok = group.some((p) => p === 1 || p === 5 || (index.has(p) && index.get(p)! < index.get(id)!));
      assert.ok(ok, `${courses.get(id)!.code} scheduled before its prerequisites`);
    }
  }
  for (const t of result.terms) {
    assert.ok(t.loadCredits <= 9, `${t.code} exceeds the preferred load`);
    for (const id of t.courseIds) assert.ok(courses.get(id)!.termsOffered.includes(t.type), `${courses.get(id)!.code} not offered in ${t.type}`);
  }
  assert.equal(result.feasible, true);
});

test('the load is spread to the target instead of front-loaded', () => {
  const four = plan({ targetSemesters: 4 });
  const eight = plan({ targetSemesters: 8 });
  assert.equal(four.graduationTerm, '2028-spring');
  assert.ok(eight.terms.filter((t) => t.semester).length > four.terms.filter((t) => t.semester).length);
  assert.ok(Math.max(...eight.terms.map((t) => t.loadCredits)) <= Math.max(...four.terms.map((t) => t.loadCredits)));
});

test('a target earlier than the prerequisite chain allows is explained by that chain', () => {
  const result = plan({ targetSemesters: 3 });
  assert.equal(result.feasible, false);
  assert.equal(result.earliestTerm, '2028-spring');
  const chain = result.issues.find((i) => i.code === 'chain');
  assert.ok(chain && chain.code === 'chain');
  assert.deepEqual(chain.chain.map((x) => courses.get(x.courseId)!.code), ['CS202', 'CS203', 'CS204']);
});

test('not enough room under the legal limit is reported as a credit problem', () => {
  const result = plan({ targetSemesters: 4 }, [], { hardMax: 3, summerMax: 6 });
  assert.equal(result.feasible, false);
  assert.ok(result.issues.some((i) => i.code === 'credits'));
});

test('going above the preferred load (within the legal limit) is flagged, not hidden', () => {
  const result = plan({ targetSemesters: 4, maxLoad: 3 });
  assert.ok(result.issues.some((i) => i.code === 'preferred_load'));
  assert.ok(result.terms.some((t) => t.overPreferred));
});

test('a light semester only gets what cannot go anywhere else', () => {
  const result = plan({ targetSemesters: 5, lightSemesters: [5] });
  const light = result.terms.find((t) => t.semester === 5);
  for (const c of light?.courses ?? []) assert.ok(c.forced || courses.get(c.courseId)!.isInternship, `${courses.get(c.courseId)!.code} could have gone earlier`);
  assert.equal(result.feasible, true);
});

test('interests pick the electives', () => {
  const none = plan();
  const ai = plan({ interests: ['ai'] });
  assert.ok(!none.targets.includes(12), 'EL3 is not needed by default');
  assert.ok(ai.targets.includes(12), 'EL3 matches the "ai" interest');
  const el3 = ai.terms.flatMap((t) => t.courses).find((c) => c.courseId === 12)!;
  assert.deepEqual(el3.interests, ['ai']);
  assert.equal(el3.reason, 'elective');
});

test('summer terms make a tight target reachable — and are used only when allowed', () => {
  // One course per main semester (legal limit 3): 18 credits cannot fit in semesters 2–5 without summers.
  const limits = { hardMax: 3, summerMax: 6 };
  const regularInSummer = (r: ReturnType<typeof plan>) =>
    r.terms.some((t) => t.type === 'summer' && t.courseIds.some((id) => !courses.get(id)!.isInternship));
  const without = plan({ targetSemesters: 5 }, [], limits);
  const withSummer = plan({ targetSemesters: 5, allowSummer: true }, [], limits);
  assert.equal(without.feasible, false);
  assert.ok(without.issues.some((i) => i.code === 'credits'));
  assert.equal(regularInSummer(without), false);
  assert.equal(withSummer.feasible, true);
  assert.equal(regularInSummer(withSummer), true);
});

test('allowing summers moves summer-eligible courses out of the main semesters', () => {
  // EL1 and ART101 also run in summer; with summers allowed they should go there and lighten the main load.
  const without = plan({ targetSemesters: 5, maxLoad: 9 });
  const withSummer = plan({ targetSemesters: 5, maxLoad: 9, allowSummer: true });
  const mainLoad = (r: ReturnType<typeof plan>) => r.terms.filter((t) => t.semester).reduce((s, t) => s + t.loadCredits, 0);
  const summerRegular = withSummer.terms
    .filter((t) => t.type === 'summer')
    .flatMap((t) => t.courseIds)
    .filter((id) => !courses.get(id)!.isInternship);
  assert.ok(summerRegular.length >= 2, `expected EL1 and ART101 in summer, got ${summerRegular.map((id) => courses.get(id)!.code)}`);
  assert.ok(mainLoad(withSummer) < mainLoad(without));
});

test('internships go to summer and do not count toward the load', () => {
  const summer = termOf(plan(), 20)!;
  assert.equal(summer.type, 'summer');
  assert.equal(summer.courseIds.length, 1);
});

test('the student’s own selection is kept as the first term, or replanned on request', () => {
  const kept = plan({}, [2, 10]);
  assert.equal(kept.terms[0].fixed, true);
  assert.deepEqual(kept.terms[0].courseIds, [2, 10]);
  assert.equal(kept.terms[0].courses[0].reason, 'selected');
  const fresh = plan({ keepSelection: false }, [2, 10]);
  assert.equal(fresh.terms[0].fixed, false);
});

test('the thesis stays in the final semester; a light final semester holds little else', () => {
  const withThesis = new Map(courses);
  withThesis.set(40, course(40, 'THESIS', 6, ['autumn', 'spring'], [[3]]));
  const cur = [...curriculum, { courseId: 40, categoryId: 1, recommendedSemester: 8 }];
  const a = auditDegree({ totalCredits: 33, categories, curriculum: cur, courses: withThesis, attempts: base, planned: [] });
  const result = planGraduation({
    courses: withThesis, categories, curriculum: cur, audit: a, planned: [], startTerm: parseTermCode('2027-spring'), startSemester: 2,
    prefs: prefs({ targetSemesters: 8, lightSemesters: [8] }), limits: { hardMax: 12, summerMax: 6 }, openPool: [30], standardSemesters: 8,
  });
  const last = result.terms[result.terms.length - 1];
  assert.equal(last.semester, 8);
  assert.ok(last.courseIds.includes(40), 'thesis in semester 8');
  assert.ok(last.courses.every((c) => c.forced), 'nothing avoidable next to the thesis');
  assert.equal(result.graduationTerm, result.targetTerm);
});

test('an elective recommended for the last semester is not held back into a light semester', () => {
  // EL2 runs in spring only and is recommended for semester 8; spring 2028 (semester 4) is light,
  // so the only good spring is semester 2. Only required final-semester courses wait for the end.
  const lateEl2 = curriculum.map((c) => (c.courseId === 11 ? { ...c, recommendedSemester: 8 } : c));
  const a = auditDegree({ totalCredits: 27, categories, curriculum: lateEl2, courses, attempts: base, planned: [] });
  const result = planGraduation({
    courses, categories, curriculum: lateEl2, audit: a, planned: [], startTerm: parseTermCode('2027-spring'), startSemester: 2,
    prefs: prefs({ targetSemesters: 4, lightSemesters: [4], maxLoad: 12 }), limits: { hardMax: 12, summerMax: 6 }, openPool: [30],
  });
  assert.ok(result.targets.includes(11), 'EL2 chosen');
  const light = result.terms.find((t) => t.semester === 4)!;
  for (const c of light.courses) assert.ok(c.forced, `${courses.get(c.courseId)!.code} could have gone earlier`);
  assert.equal(termOf(result, 11)?.semester, 2);
});

test('a course whose last non-light term has come goes in, even above the even share', () => {
  // Two spring-only courses; semester 4 (the next spring) is light. The even share of semester 2
  // is about one course, but both must go now or end up in the light semester.
  const mini = new Map([course(1, 'S1', 3, ['spring']), course(2, 'S2', 3, ['spring'])].map((c) => [c.id, c]));
  const cats: RequirementCategory[] = [{ id: 1, code: 'CORE', name: text('Core'), group: 'professional', isElective: false, minCredits: 6, sortOrder: 1 }];
  const cur: CurriculumEntry[] = [
    { courseId: 1, categoryId: 1, recommendedSemester: 2 },
    { courseId: 2, categoryId: 1, recommendedSemester: 2 },
  ];
  const a = auditDegree({ totalCredits: 6, categories: cats, curriculum: cur, courses: mini, attempts: [], planned: [] });
  const result = planGraduation({
    courses: mini, categories: cats, curriculum: cur, audit: a, planned: [], startTerm: parseTermCode('2027-spring'), startSemester: 2,
    prefs: prefs({ targetSemesters: 4, lightSemesters: [4] }), limits: { hardMax: 12, summerMax: 6 },
  });
  assert.deepEqual([...result.terms[0].courseIds].sort(), [1, 2]);
});

test('prerequisite cycles are detected instead of looping', () => {
  const cyclic = new Map(courses);
  cyclic.set(3, { ...courses.get(3)!, prerequisiteGroups: [[4]] });
  cyclic.set(4, { ...courses.get(4)!, prerequisiteGroups: [[3]] });
  const cycle = findCycles([3, 4, 2], cyclic, new Set([1]));
  assert.deepEqual([...cycle].sort(), [3, 4]);
});

test('an elective that runs in the coming term beats one recommended earlier but offered later', () => {
  // EL3 is recommended earlier (semester 2) but autumn-only; EL2 runs this spring.
  const earlyEl3 = curriculum.map((c) => (c.courseId === 12 ? { ...c, recommendedSemester: 2 } : c));
  const attempts = [...base, done(2, 'A', 3.7), done(10, 'A', 3.7)];
  const a = auditDegree({ totalCredits: 27, categories, curriculum: earlyEl3, courses, attempts, planned: [] });
  const result = planGraduation({
    courses, categories, curriculum: earlyEl3, audit: a, planned: [], startTerm: parseTermCode('2027-spring'), startSemester: 2,
    prefs: prefs({ targetSemesters: 4 }), limits: { hardMax: 12, summerMax: 6 }, openPool: [30],
  });
  assert.ok(result.targets.includes(11), 'EL2 chosen');
  assert.ok(!result.targets.includes(12), 'EL3 not needed');
});
