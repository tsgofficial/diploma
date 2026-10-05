/**
 * Degree audit: how far a student is toward graduation, per curriculum block.
 *
 * Every course a student passed, is taking, or has selected becomes a credit
 * item that is poured into its curriculum category (required / elective, by
 * group). An elective block that is already full overflows into the open
 * electives (нээлттэй сонгон), and anything beyond that counts toward nothing.
 * Courses outside the curriculum go straight to open electives. Required
 * blocks list the courses still missing.
 */
import { computeGpa } from './grading';
import { Attempt, CatalogCourse, CategoryGroup, CurriculumEntry, LocalizedText, RequirementCategory } from './types';

export type CourseState = 'passed' | 'in_progress' | 'planned' | 'missing';

export interface CourseRecord {
  courseId: number;
  passed: boolean;
  inProgress: boolean;
  /** Best completed attempt — a retaken course counts once, with its best grade. */
  bestLetter: string | null;
  bestPoint: number | null;
  attempts: number;
}

export interface CategoryCourse {
  courseId: number;
  code: string;
  name: LocalizedText;
  credits: number;
  state: CourseState;
  letter: string | null;
}

export interface CategoryProgress {
  categoryId: number;
  code: string;
  name: LocalizedText;
  group: CategoryGroup;
  isElective: boolean;
  minCredits: number;
  earned: number;
  inProgress: number;
  planned: number;
  /** Still needed, counting only passed courses. */
  remaining: number;
  /** Still needed if everything in progress and selected is passed. */
  projectedRemaining: number;
  courses: CategoryCourse[];
}

export interface AuditInput {
  totalCredits: number;
  categories: RequirementCategory[];
  curriculum: CurriculumEntry[];
  courses: Map<number, CatalogCourse>;
  attempts: Attempt[];
  /** Courses selected for the registration term. */
  planned: number[];
}

export interface AuditResult {
  totals: {
    required: number;
    earned: number;
    inProgress: number;
    planned: number;
    remaining: number;
    projectedRemaining: number;
  };
  gpa: number | null;
  /** Credits that count toward no requirement (beyond every block's minimum). */
  extraCredits: number;
  categories: CategoryProgress[];
  records: Map<number, CourseRecord>;
}

/** Collapse attempts into one record per course. */
export function summarizeAttempts(attempts: Attempt[]): Map<number, CourseRecord> {
  const records = new Map<number, CourseRecord>();
  const sorted = [...attempts].sort((a, b) => a.termSeq - b.termSeq);
  for (const a of sorted) {
    const r = records.get(a.courseId) ?? {
      courseId: a.courseId,
      passed: false,
      inProgress: false,
      bestLetter: null,
      bestPoint: null,
      attempts: 0,
    };
    if (a.status === 'in_progress') r.inProgress = true;
    if (a.status === 'completed') {
      r.attempts += 1;
      if (a.passed) r.passed = true;
      if (a.point !== null && (r.bestPoint === null || a.point >= r.bestPoint)) {
        r.bestPoint = a.point;
        r.bestLetter = a.letter;
      }
    }
    records.set(a.courseId, r);
  }
  return records;
}

export function auditDegree(input: AuditInput): AuditResult {
  const records = summarizeAttempts(input.attempts);
  const categoryOf = new Map(input.curriculum.map((c) => [c.courseId, c.categoryId]));
  const ordered = [...input.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const openCategory = ordered.find((c) => c.group === 'open') ?? null;

  const fill = new Map(ordered.map((c) => [c.id, { passed: 0, in_progress: 0, planned: 0, courses: [] as CategoryCourse[] }]));
  const used = (id: number) => {
    const f = fill.get(id)!;
    return f.passed + f.in_progress + f.planned;
  };
  let extraCredits = 0;

  // Credit items in the order they are poured: passed, then in progress, then planned.
  const planned = new Set(input.planned);
  const items: Array<{ courseId: number; state: Exclude<CourseState, 'missing'> }> = [];
  for (const r of records.values()) {
    if (r.passed) items.push({ courseId: r.courseId, state: 'passed' });
    else if (r.inProgress) items.push({ courseId: r.courseId, state: 'in_progress' });
  }
  for (const id of planned) {
    const r = records.get(id);
    if (!r?.passed && !r?.inProgress) items.push({ courseId: id, state: 'planned' });
  }
  const stateRank = { passed: 0, in_progress: 1, planned: 2 };
  items.sort((a, b) => stateRank[a.state] - stateRank[b.state] || a.courseId - b.courseId);

  const categoryById = new Map(ordered.map((c) => [c.id, c]));
  for (const item of items) {
    const course = input.courses.get(item.courseId);
    if (!course) continue;
    const home = categoryOf.get(item.courseId);
    const homeCategory = home !== undefined ? categoryById.get(home) : undefined;
    // A required block always takes its own courses; an elective block only while it has room.
    let target: RequirementCategory | null = null;
    if (homeCategory && (!homeCategory.isElective || used(homeCategory.id) < homeCategory.minCredits)) target = homeCategory;
    else if (openCategory && used(openCategory.id) < openCategory.minCredits) target = openCategory;

    if (!target) {
      if (item.state === 'passed') extraCredits += course.credits;
      continue;
    }
    const f = fill.get(target.id)!;
    f[item.state] += course.credits;
    f.courses.push({
      courseId: course.id,
      code: course.code,
      name: course.name,
      credits: course.credits,
      state: item.state,
      letter: records.get(course.id)?.bestLetter ?? null,
    });
  }

  // Required courses nobody has taken yet.
  for (const entry of input.curriculum) {
    const category = categoryById.get(entry.categoryId);
    if (!category || category.isElective) continue;
    const f = fill.get(category.id)!;
    if (f.courses.some((c) => c.courseId === entry.courseId)) continue;
    const course = input.courses.get(entry.courseId);
    if (!course) continue;
    f.courses.push({ courseId: course.id, code: course.code, name: course.name, credits: course.credits, state: 'missing', letter: null });
  }

  const categories: CategoryProgress[] = ordered.map((c) => {
    const f = fill.get(c.id)!;
    const min = c.minCredits;
    const earned = Math.min(f.passed, min);
    const withProgress = Math.min(f.passed + f.in_progress, min);
    const withPlanned = Math.min(f.passed + f.in_progress + f.planned, min);
    const rank = { passed: 0, in_progress: 1, planned: 2, missing: 3 };
    return {
      categoryId: c.id,
      code: c.code,
      name: c.name,
      group: c.group,
      isElective: c.isElective,
      minCredits: min,
      earned,
      inProgress: withProgress - earned,
      planned: withPlanned - withProgress,
      remaining: min - earned,
      projectedRemaining: min - withPlanned,
      courses: f.courses.sort((a, b) => rank[a.state] - rank[b.state] || a.code.localeCompare(b.code)),
    };
  });

  const sum = (key: 'earned' | 'inProgress' | 'planned' | 'remaining' | 'projectedRemaining') =>
    categories.reduce((total, c) => total + c[key], 0);

  const gpa = computeGpa(
    [...records.values()]
      .filter((r) => r.attempts > 0)
      .map((r) => ({ credits: input.courses.get(r.courseId)?.credits ?? 0, point: r.bestPoint }))
  );

  return {
    totals: {
      required: input.totalCredits,
      earned: sum('earned'),
      inProgress: sum('inProgress'),
      planned: sum('planned'),
      remaining: sum('remaining'),
      projectedRemaining: sum('projectedRemaining'),
    },
    gpa,
    extraCredits,
    categories,
    records,
  };
}
