/**
 * Graduation planner: a term-by-term path through the remaining requirements,
 * shaped by the student's wishes — graduate in 3, 3.5 or 4 years, use summer
 * terms or not, a preferred load, semesters to keep light (the thesis
 * semester), and interests that pick the electives.
 *
 * 1. Targets — every missing required course, plus electives chosen to cover
 *    each elective block's remaining credits: reachable first, then the best
 *    match to the student's interests, then the one that can run soonest.
 *    Prerequisites of targets that are neither passed nor planned are added
 *    (closure), so the plan never contains a course that cannot be taken.
 * 2. Earliest term (forward pass) — the first term a course can run given its
 *    prerequisite chain and the terms it is offered in. The largest one is the
 *    earliest possible graduation; when the wished target is earlier, the
 *    chain that forces the delay is returned as the explanation.
 * 3. Latest term (backward pass from the target) — the last term a course
 *    can take without pushing a later course past the target. Latest −
 *    earliest is the slack.
 * 4. Scheduling, term by term — courses whose latest term has come are
 *    placed first (they cannot wait; the legal limit of 9.6 still applies),
 *    then those whose last non-light term has come, then the rest by
 *    fewest remaining chances (so a course a summer can absorb waits for the
 *    summer), deadline, critical-path length, required before elective
 *    and interest, up to an even share of the remaining credits so the load is
 *    balanced to the target. Light semesters receive only what cannot go
 *    anywhere else. Internships are not part of the load (9.6) and run in
 *    summer (8.12). Final-semester courses (thesis) go as late as possible.
 * 5. Repair — if an elective is what makes the plan miss the target, plan
 *    again with that elective as a last resort (see `planGraduation`).
 */
import { AuditResult } from './degreeAudit';
import { isMainTerm, nextTerm, parseTermCode, TermRef, termCode, termSeq } from './terms';
import { CatalogCourse, CurriculumEntry, RequirementCategory } from './types';

export interface PlanPreferences {
  /** Graduate after this many main semesters since admission (8 = 4 years). Null = the standard length. */
  targetSemesters: number | null;
  /** Ordinary courses may be taken in summer terms (internships always are). */
  allowSummer: boolean;
  /** Preferred credits per main semester (the regulation's limit still caps it). */
  maxLoad: number;
  /** Semester numbers to keep as light as possible, e.g. [8] for the thesis. */
  lightSemesters: number[];
  /** Interest tags that steer the choice of electives. */
  interests: string[];
  /** Keep the student's current selection as the first term. */
  keepSelection: boolean;
}

/** Legal limits from the rules (9.6): per main semester and per summer. */
export interface PlannerLimits {
  hardMax: number;
  summerMax: number;
}

export interface PlannerInput {
  courses: Map<number, CatalogCourse>;
  categories: RequirementCategory[];
  curriculum: CurriculumEntry[];
  audit: AuditResult;
  /** The current selection for `startTerm`. */
  planned: number[];
  startTerm: TermRef;
  /** Semester number of `startTerm` for this student. */
  startSemester: number;
  prefs: PlanPreferences;
  limits: PlannerLimits;
  /** Non-curriculum courses that may fill open electives. */
  openPool?: number[];
  /** Standard program length in semesters (bachelor: 8). */
  standardSemesters?: number;
}

export type PlanReason = 'selected' | 'required' | 'elective' | 'prerequisite';

export interface PlannedCourse {
  courseId: number;
  reason: PlanReason;
  /** The student's interests this elective matches. */
  interests: string[];
  /** Had no slack: any later and the target would be missed. */
  forced: boolean;
}

export interface PlannedTerm {
  code: string;
  year: number;
  type: TermRef['type'];
  semester: number | null;
  courses: PlannedCourse[];
  courseIds: number[];
  credits: number;
  loadCredits: number;
  fixed: boolean;
  light: boolean;
  /** Above the student's preferred load (still within the legal limit). */
  overPreferred: boolean;
}

export type PlanIssue =
  | { code: 'chain'; chain: Array<{ courseId: number; term: string }> }
  | { code: 'credits'; needed: number; capacity: number }
  | { code: 'overload'; term: string; courseIds: number[] }
  | { code: 'preferred_load'; terms: string[] }
  | { code: 'unschedulable'; courseIds: number[]; reason: 'never_offered' | 'prerequisite_cycle' };

export interface PlanResult {
  terms: PlannedTerm[];
  /** The term the plan aims to graduate in. */
  targetTerm: string;
  /** Last term with courses — null when some course cannot be scheduled at all. */
  graduationTerm: string | null;
  /** The earliest graduation the prerequisite chains allow. */
  earliestTerm: string | null;
  /** Graduates no later than the target, within every limit. */
  feasible: boolean;
  issues: PlanIssue[];
  targets: number[];
}

// ------------------------------------------------------------- targets ----

function interestMatches(course: CatalogCourse | undefined, interests: string[]): string[] {
  return (course?.tags ?? []).filter((t) => interests.includes(t));
}

export function chooseTargets(
  input: PlannerInput,
  done: Set<number>,
  avoid: ReadonlySet<number> = new Set()
): { targets: number[]; reasons: Map<number, { reason: PlanReason; interests: string[] }> } {
  const { courses, curriculum, audit, prefs } = input;
  const keep = prefs.keepSelection ? input.planned : [];
  const reasons = new Map<number, { reason: PlanReason; interests: string[] }>();
  const targets = new Set<number>(keep);
  for (const id of keep) reasons.set(id, { reason: 'selected', interests: interestMatches(courses.get(id), prefs.interests) });
  const taken = (id: number) => done.has(id) || targets.has(id);

  for (const category of audit.categories) {
    if (category.isElective) continue;
    for (const c of category.courses) {
      if (c.state === 'missing' && !targets.has(c.courseId)) {
        targets.add(c.courseId);
        reasons.set(c.courseId, { reason: 'required', interests: [] });
      }
    }
  }

  const recommended = new Map(curriculum.map((c) => [c.courseId, c.recommendedSemester ?? 99]));
  const reachable = (id: number) =>
    (courses.get(id)?.prerequisiteGroups ?? []).every((g) => g.some((p) => done.has(p) || targets.has(p)));
  // Terms from the start until the course could run if its prerequisites are done.
  const earliest = (id: number) => {
    const course = courses.get(id)!;
    if (!course.prerequisiteGroups.every((g) => g.some((p) => done.has(p)))) return 50;
    let term = input.startTerm;
    for (let i = 0; i < 8; i += 1, term = nextTerm(term)) {
      if (i === 0 && keep.length > 0) continue;
      if (isMainTerm(term.type) && course.termsOffered.includes(term.type)) return i;
    }
    return 99;
  };
  const score = (id: number) => interestMatches(courses.get(id), prefs.interests).length;

  for (const category of audit.categories) {
    if (!category.isElective) continue;
    let needed = category.projectedRemaining;
    if (needed <= 0) continue;
    const pool =
      category.group === 'open'
        ? input.openPool ?? []
        : curriculum.filter((c) => c.categoryId === category.categoryId).map((c) => c.courseId);
    const candidates = pool
      .filter((id) => courses.has(id) && !taken(id))
      .sort(
        (a, b) =>
          Number(reachable(b)) - Number(reachable(a)) ||
          Number(avoid.has(a)) - Number(avoid.has(b)) ||
          score(b) - score(a) ||
          earliest(a) - earliest(b) ||
          (recommended.get(a) ?? 99) - (recommended.get(b) ?? 99) ||
          courses.get(a)!.code.localeCompare(courses.get(b)!.code)
      );
    for (const id of candidates) {
      if (needed <= 0) break;
      targets.add(id);
      reasons.set(id, { reason: 'elective', interests: interestMatches(courses.get(id), prefs.interests) });
      needed -= courses.get(id)!.credits;
    }
  }

  // Prerequisite closure: add the first option of any group nothing satisfies yet.
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...targets]) {
      for (const group of courses.get(id)?.prerequisiteGroups ?? []) {
        if (group.some((p) => done.has(p) || targets.has(p))) continue;
        const pick = group.find((p) => courses.has(p));
        if (pick !== undefined) {
          targets.add(pick);
          reasons.set(pick, { reason: 'prerequisite', interests: [] });
          changed = true;
        }
      }
    }
  }
  return { targets: [...targets], reasons };
}

/** Courses that sit on a prerequisite cycle among the targets. */
export function findCycles(targets: number[], courses: Map<number, CatalogCourse>, done: Set<number>): Set<number> {
  const inTargets = new Set(targets);
  const color = new Map<number, 0 | 1 | 2>(); // 0 white, 1 on stack, 2 finished
  const onCycle = new Set<number>();
  const stack: number[] = [];

  function visit(id: number): void {
    color.set(id, 1);
    stack.push(id);
    for (const group of courses.get(id)?.prerequisiteGroups ?? []) {
      if (group.some((p) => done.has(p))) continue;
      for (const p of group) {
        if (!inTargets.has(p)) continue;
        const c = color.get(p) ?? 0;
        if (c === 0) visit(p);
        else if (c === 1) stack.slice(stack.indexOf(p)).forEach((x) => onCycle.add(x));
      }
    }
    stack.pop();
    color.set(id, 2);
  }

  for (const id of targets) if ((color.get(id) ?? 0) === 0) visit(id);
  return onCycle;
}

/** Longest chain of target courses that (transitively) need `id` — the critical path. */
function chainLengths(targets: number[], courses: Map<number, CatalogCourse>): Map<number, number> {
  const dependents = new Map<number, number[]>();
  for (const id of targets) {
    for (const group of courses.get(id)?.prerequisiteGroups ?? []) {
      for (const p of group) dependents.set(p, [...(dependents.get(p) ?? []), id]);
    }
  }
  const memo = new Map<number, number>();
  const length = (id: number, guard: Set<number>): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (guard.has(id)) return 0;
    guard.add(id);
    const next = (dependents.get(id) ?? []).map((d) => length(d, guard));
    guard.delete(id);
    const value = 1 + (next.length ? Math.max(...next) : 0);
    memo.set(id, value);
    return value;
  };
  for (const id of targets) length(id, new Set());
  return memo;
}

// --------------------------------------------------------------- terms ----

interface TermSlot {
  ref: TermRef;
  code: string;
  semester: number | null;
  main: boolean;
  light: boolean;
  fixed: boolean;
}

/** Main and summer terms from `start` through semester `until` (winter terms are skipped). */
function buildSlots(input: PlannerInput, until: number): TermSlot[] {
  const { prefs } = input;
  const fixedStart = prefs.keepSelection && input.planned.length > 0;
  const slots: TermSlot[] = [];
  let t = input.startTerm;
  let semester = input.startSemester;
  while (slots.length < 60) {
    if (t.type !== 'winter') {
      const main = isMainTerm(t.type);
      if (main && semester > until) break;
      slots.push({
        ref: t,
        code: termCode(t),
        semester: main ? semester : null,
        main,
        light: main && prefs.lightSemesters.includes(semester),
        fixed: slots.length === 0 && fixedStart,
      });
      if (main) semester += 1;
    }
    t = nextTerm(t);
  }
  return slots;
}

// -------------------------------------------------------------- planner ----

/** One planning pass; `avoid` lists electives to choose only when nothing else covers the block. */
function planOnce(input: PlannerInput, avoid: ReadonlySet<number>): { result: PlanResult; lateElectives: number[] } {
  const { courses, prefs, limits } = input;
  const standard = input.standardSemesters ?? 8;
  const targetSemester = Math.max(input.startSemester, prefs.targetSemesters ?? standard);
  const prefCap = Math.min(prefs.maxLoad, limits.hardMax);
  const slots = buildSlots(input, targetSemester + 8);
  const targetIdx = slots.findIndex((s) => s.semester === targetSemester);
  const fixedIds = new Set(slots[0]?.fixed ? input.planned : []);

  const done = new Set<number>();
  for (const r of input.audit.records.values()) if (r.passed || r.inProgress) done.add(r.courseId);

  const { targets, reasons } = chooseTargets(input, done, avoid);
  const targetSet = new Set(targets);
  const issues: PlanIssue[] = [];

  const cycle = findCycles(targets, courses, done);
  const neverOffered = targets.filter((id) => (courses.get(id)?.termsOffered.length ?? 0) === 0);
  if (cycle.size) issues.push({ code: 'unschedulable', courseIds: [...cycle], reason: 'prerequisite_cycle' });
  if (neverOffered.length) issues.push({ code: 'unschedulable', courseIds: neverOffered, reason: 'never_offered' });

  const offeredIn = (id: number, slot: TermSlot) => {
    const c = courses.get(id)!;
    if (slot.main) return c.termsOffered.includes(slot.ref.type);
    return c.termsOffered.includes('summer') && (c.isInternship || prefs.allowSummer);
  };
  // Load excludes internships (9.6); a summer's total, internships included, is still capped by summerMax.
  const loadOf = (id: number) => (courses.get(id)!.isInternship ? 0 : courses.get(id)!.credits);

  // ---- 2. earliest term (forward pass) -----------------------------------
  const es = new Map<number, number>();
  const via = new Map<number, number | null>();
  const visiting = new Set<number>();
  const earliestOf = (id: number): number => {
    if (es.has(id)) return es.get(id)!;
    if (visiting.has(id) || cycle.has(id)) return Infinity;
    visiting.add(id);
    let result: number;
    let cause: number | null = null;
    if (fixedIds.has(id)) result = 0;
    else {
      let min = slots[0]?.fixed ? 1 : 0;
      for (const group of courses.get(id)?.prerequisiteGroups ?? []) {
        if (group.some((p) => done.has(p))) continue;
        let best = Infinity;
        let bestId: number | null = null;
        for (const p of group) {
          if (!targetSet.has(p)) continue;
          const e = earliestOf(p);
          if (e < best) [best, bestId] = [e, p];
        }
        if (best + 1 > min) [min, cause] = [best + 1, bestId];
      }
      let k = min;
      while (k < slots.length && !offeredIn(id, slots[k])) k += 1;
      result = Number.isFinite(min) && k < slots.length ? k : Infinity;
    }
    visiting.delete(id);
    es.set(id, result);
    via.set(id, cause);
    return result;
  };
  for (const id of targets) earliestOf(id);

  const reachableTargets = targets.filter((id) => Number.isFinite(es.get(id)));
  const earliestIdx = reachableTargets.reduce((m, id) => Math.max(m, es.get(id)!), 0);
  const goalIdx = targetIdx < 0 ? earliestIdx : Math.max(targetIdx, earliestIdx);

  if (targetIdx >= 0 && earliestIdx > targetIdx) {
    // Explain with the chain that forces the delay: follow `via` back from the latest course.
    let id: number | null = reachableTargets.find((x) => es.get(x) === earliestIdx) ?? null;
    const chain: Array<{ courseId: number; term: string }> = [];
    while (id !== null) {
      chain.unshift({ courseId: id, term: slots[es.get(id)!].code });
      id = via.get(id) ?? null;
    }
    issues.push({ code: 'chain', chain });
  }

  // ---- 3. latest term (backward pass) ------------------------------------
  // A course only constrains a dependent through the prerequisite actually used (its `via` choice
  // or the single target member of the group).
  const dependents = new Map<number, number[]>();
  for (const d of targets) {
    for (const group of courses.get(d)?.prerequisiteGroups ?? []) {
      if (group.some((p) => done.has(p))) continue;
      const members = group.filter((p) => targetSet.has(p));
      const used = members.length === 1 ? members[0] : members.find((p) => p === via.get(d)) ?? members[0];
      if (used !== undefined) dependents.set(used, [...(dependents.get(used) ?? []), d]);
    }
  }
  const ls = new Map<number, number>();
  const latestOf = (id: number, guard = new Set<number>()): number => {
    if (ls.has(id)) return ls.get(id)!;
    if (guard.has(id)) return -1;
    guard.add(id);
    let bound = goalIdx;
    for (const d of dependents.get(id) ?? []) bound = Math.min(bound, latestOf(d, guard) - 1);
    let k = bound;
    while (k >= 0 && !offeredIn(id, slots[k])) k -= 1;
    guard.delete(id);
    ls.set(id, k);
    return k;
  };
  for (const id of targets) latestOf(id);

  // ---- capacity check ----------------------------------------------------
  const remaining = new Set(reachableTargets.filter((id) => !fixedIds.has(id)));
  const loadNeeded = [...remaining].reduce((s, id) => s + (courses.get(id)!.isInternship ? 0 : courses.get(id)!.credits), 0);
  const capacityUntil = (idx: number, legal: boolean) =>
    slots
      .slice(0, idx + 1)
      .filter((s) => !s.fixed)
      .reduce((sum, s) => sum + (s.main ? (legal ? limits.hardMax : s.light ? 0 : prefCap) : prefs.allowSummer ? limits.summerMax : 0), 0);
  if (targetIdx >= 0 && loadNeeded > capacityUntil(targetIdx, true)) {
    issues.push({ code: 'credits', needed: loadNeeded, capacity: capacityUntil(targetIdx, true) });
  }

  // ---- 4. scheduling ------------------------------------------------------
  const chain = chainLengths(targets, courses);
  const recommended = new Map(input.curriculum.map((c) => [c.courseId, c.recommendedSemester ?? 99]));
  const required = new Set(input.audit.categories.filter((c) => !c.isElective).flatMap((c) => c.courses.map((x) => x.courseId)));
  const interestScore = (id: number) => reasons.get(id)?.interests.length ?? 0;
  const weight = (s: TermSlot) => (s.fixed || s.light ? 0 : s.main ? prefCap : prefs.allowSummer ? limits.summerMax : 0);
  // Deadline: the last term a course can run in that is not a light semester. Once it has come the
  // course goes in while there is room, instead of falling through to the light semester.
  const deadline = new Map<number, number>();
  for (const id of targets) {
    let k = ls.get(id) ?? -1;
    while (k >= 0 && !(offeredIn(id, slots[k]) && weight(slots[k]) > 0)) k -= 1;
    deadline.set(id, k >= 0 ? k : ls.get(id) ?? -1);
  }
  // Remaining chances: usable terms from `i` to the deadline that offer the course. The least flexible
  // course goes first, so a course a summer can absorb waits for the summer when summers are allowed.
  const chances = (id: number, i: number) => {
    let n = 0;
    for (let k = i; k <= (deadline.get(id) ?? -1); k += 1) if (offeredIn(id, slots[k]) && weight(slots[k]) > 0) n += 1;
    return n;
  };
  const priorityAt = (i: number) => (a: number, b: number) =>
    chances(a, i) - chances(b, i) ||
    (deadline.get(a) ?? 0) - (deadline.get(b) ?? 0) ||
    (chain.get(b) ?? 1) - (chain.get(a) ?? 1) ||
    Number(required.has(b)) - Number(required.has(a)) ||
    interestScore(b) - interestScore(a) ||
    (recommended.get(a) ?? 99) - (recommended.get(b) ?? 99) ||
    courses.get(a)!.code.localeCompare(courses.get(b)!.code);
  // Required final-semester courses (the thesis, the pre-diploma internship) belong at the end of the plan:
  // they are scheduled as late as possible rather than as early as possible.
  const capstone = (id: number) => required.has(id) && (recommended.get(id) ?? 0) >= standard;

  const doneBefore = new Set(done);
  const terms: PlannedTerm[] = [];
  const overPreferred: string[] = [];
  const satisfied = (id: number) => courses.get(id)!.prerequisiteGroups.every((g) => g.some((p) => doneBefore.has(p)));

  slots.forEach((slot, i) => {
    if (remaining.size === 0 && !slot.fixed) return;
    const picked: PlannedCourse[] = [];
    const add = (id: number, forced: boolean) => {
      picked.push({ courseId: id, reason: reasons.get(id)?.reason ?? 'required', interests: reasons.get(id)?.interests ?? [], forced });
      remaining.delete(id);
    };

    if (slot.fixed) {
      for (const id of input.planned) add(id, false);
    } else {
      const available = [...remaining].filter((id) => offeredIn(id, slot) && satisfied(id)).sort(priorityAt(i));
      const pastGoal = i > goalIdx;
      const hard = slot.main ? limits.hardMax : limits.summerMax;
      const cap = pastGoal ? (slot.main ? prefCap : prefs.allowSummer ? limits.summerMax : 0) : slot.main ? (slot.light ? 0 : prefCap) : prefs.allowSummer ? limits.summerMax : 0;
      const pending = [...remaining].reduce((s, id) => s + (courses.get(id)!.isInternship ? 0 : courses.get(id)!.credits), 0);
      const ahead = slots.slice(i, goalIdx + 1).reduce((s, x) => s + weight(x), 0);
      // Even share of what is left, so the load is spread to the target instead of front-loaded.
      const share = pastGoal || ahead === 0 ? cap : (pending * weight(slot)) / ahead;
      const soft = Math.min(cap, Math.ceil(share) + 1);
      let load = 0;
      let total = 0;
      const overflow: number[] = [];
      const fitsSummer = (id: number) => slot.main || total + courses.get(id)!.credits <= limits.summerMax;
      const take = (id: number, forced: boolean) => {
        add(id, forced);
        load += loadOf(id);
        total += courses.get(id)!.credits;
      };

      for (const id of available) {
        const l = loadOf(id);
        const forced = !pastGoal && (ls.get(id) ?? Infinity) <= i;
        if (!forced && !pastGoal && capstone(id)) continue;
        if (forced || pastGoal) {
          if (load + l <= (pastGoal ? cap : hard) && fitsSummer(id)) take(id, forced);
          else if (forced) overflow.push(id);
        } else if (courses.get(id)!.isInternship) {
          if (fitsSummer(id)) take(id, false);
        } else if (load + l <= ((deadline.get(id) ?? Infinity) <= i ? cap : soft) && fitsSummer(id)) {
          take(id, false);
        }
      }
      if (overflow.length) issues.push({ code: 'overload', term: slot.code, courseIds: overflow });
      if (slot.main && load > prefCap) overPreferred.push(slot.code);
    }

    for (const p of picked) doneBefore.add(p.courseId);
    const list = picked.map((p) => courses.get(p.courseId)!);
    // Keep empty main terms up to the goal so gaps in the plan stay visible; drop empty summers.
    if (picked.length === 0 && (!slot.main || i > goalIdx)) return;
    terms.push({
      code: slot.code,
      year: slot.ref.year,
      type: slot.ref.type,
      semester: slot.semester,
      courses: picked,
      courseIds: picked.map((p) => p.courseId),
      credits: list.reduce((s, c) => s + c.credits, 0),
      loadCredits: slot.main ? list.filter((c) => !c.isInternship).reduce((s, c) => s + c.credits, 0) : list.reduce((s, c) => s + c.credits, 0),
      fixed: slot.fixed,
      light: slot.light,
      overPreferred: slot.main && list.filter((c) => !c.isInternship).reduce((s, c) => s + c.credits, 0) > prefCap,
    });
  });

  if (overPreferred.length) issues.push({ code: 'preferred_load', terms: overPreferred });

  // Trailing empty terms say nothing.
  while (terms.length && terms[terms.length - 1].courses.length === 0) terms.pop();

  const lastIdx = terms.length ? slots.findIndex((s) => s.code === terms[terms.length - 1].code) : -1;
  const unschedulable = cycle.size > 0 || neverOffered.length > 0 || remaining.size > 0;
  const blocking = issues.some((x) => x.code === 'chain' || x.code === 'credits' || x.code === 'overload');

  // Electives that overflowed a term or landed after the target — candidates for a different choice.
  const overflowed = new Set(issues.flatMap((x) => (x.code === 'overload' ? x.courseIds : [])));
  const late = new Set(terms.filter((t) => slots.findIndex((x) => x.code === t.code) > targetIdx).flatMap((t) => t.courseIds));
  const lateElectives = targets.filter((id) => reasons.get(id)?.reason === 'elective' && (overflowed.has(id) || late.has(id) || remaining.has(id)));

  return {
    result: {
      terms,
      targetTerm: targetIdx >= 0 ? slots[targetIdx].code : slots[slots.length - 1]?.code ?? '',
      graduationTerm: unschedulable || !terms.length ? null : terms[terms.length - 1].code,
      earliestTerm: slots[earliestIdx]?.code ?? null,
      feasible: !unschedulable && !blocking && (targetIdx < 0 || lastIdx <= targetIdx),
      issues,
      targets,
    },
    lateElectives,
  };
}

/** Sort key of a plan: feasible first, then earlier graduation, then fewer issues. */
function rank(r: PlanResult): [number, number, number] {
  const end = r.terms.length ? termSeq(parseTermCode(r.terms[r.terms.length - 1].code)) : 0;
  return [r.feasible ? 0 : 1, r.graduationTerm ? end : Infinity, r.issues.length];
}

function better(a: PlanResult, b: PlanResult): boolean {
  const [x, y] = [rank(a), rank(b)];
  for (let i = 0; i < x.length; i += 1) if (x[i] !== y[i]) return x[i] < y[i];
  return false;
}

/**
 * Plans, then repairs: when an elective is what makes the plan miss its
 * target (it overflows a term or runs late), plan again choosing that
 * elective only as a last resort, so another elective of the same block that
 * fits the calendar takes its place. A few rounds, the best plan wins.
 */
export function planGraduation(input: PlannerInput): PlanResult {
  const avoid = new Set<number>();
  let { result: best, lateElectives } = planOnce(input, avoid);
  for (let round = 0; round < 6 && !best.feasible; round += 1) {
    const fresh = lateElectives.filter((id) => !avoid.has(id));
    if (fresh.length === 0) break;
    fresh.forEach((id) => avoid.add(id));
    const next = planOnce(input, avoid);
    lateElectives = next.lateElectives;
    if (better(next.result, best)) best = next.result;
  }
  return best;
}
