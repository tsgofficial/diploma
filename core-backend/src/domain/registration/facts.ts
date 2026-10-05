/**
 * Fact builders — the bridge between academic records and the rule engine.
 *
 * Services load a context once (student, transcript, catalog, current
 * selection) and these pure functions turn it into rule subjects for any
 * hypothetical plan. That is what makes "what if I add CS204?" cheap: same
 * context, different plan, re-evaluate.
 *
 * FACT_CATALOG lists every fact a rule may reference, per phase and scope;
 * the rule validator rejects anything else.
 */
import type { FactCatalog } from '../rule-engine/validate';
import type { Subject } from '../rule-engine/types';
import type { CourseRecord } from '../academics/degreeAudit';
import type { CatalogCourse, CurriculumEntry, SectionType } from '../academics/types';
import { isMainTerm, TermType } from '../academics/terms';
import { conflictsWith, Meeting, TimedSection } from '../scheduling/timeslot';

const STUDENT_FACTS = [
  'student.code',
  'student.semester',
  'student.year',
  'student.gpa',
  'student.earnedCredits',
  'student.lastTermGpa',
  'student.onWarning',
  'student.warningCount',
  'student.isDualProgram',
] as const;

const TERM_FACTS = ['term.code', 'term.type', 'term.isMain'] as const;

const SELECTION_PLAN_FACTS = [
  ...STUDENT_FACTS,
  ...TERM_FACTS,
  'plan.courseCount',
  'plan.totalCredits',
  'plan.loadCredits',
  'plan.internshipCredits',
  'plan.courseCodes',
] as const;

const SELECTION_COURSE_FACTS = [
  ...SELECTION_PLAN_FACTS,
  'course.code',
  'course.name',
  'course.credits',
  'course.level',
  'course.isInternship',
  'course.offered',
  'course.inCurriculum',
  'course.category',
  'course.isRequired',
  'course.recommendedSemester',
  'course.passed',
  'course.bestLetter',
  'course.bestGradePoint',
  'course.attempts',
  'course.inProgress',
  'course.prereqStatus',
  'course.missingPrerequisites',
  'course.pendingPrerequisites',
] as const;

const SCHEDULE_PLAN_FACTS = [
  ...STUDENT_FACTS,
  ...TERM_FACTS,
  'plan.courseCount',
  'plan.completeCourses',
  'plan.pickedSections',
  'plan.campusDays',
  'plan.maxMeetingsPerDay',
] as const;

const SCHEDULE_COURSE_FACTS = [
  ...SCHEDULE_PLAN_FACTS,
  'course.code',
  'course.name',
  'course.requiredComponents',
  'course.pickedComponents',
  'course.missingComponents',
  'course.missingComponentsMn',
  'course.missingComponentsEn',
] as const;

const SCHEDULE_SECTION_FACTS = [
  ...SCHEDULE_PLAN_FACTS,
  'section.code',
  'section.label',
  'section.type',
  'section.courseCode',
  'section.courseSelected',
  'section.instructor',
  'section.conflictCount',
  'section.conflictsWith',
] as const;

export const FACT_CATALOG: FactCatalog = {
  selection: { plan: SELECTION_PLAN_FACTS, course: SELECTION_COURSE_FACTS },
  schedule: { plan: SCHEDULE_PLAN_FACTS, course: SCHEDULE_COURSE_FACTS, section: SCHEDULE_SECTION_FACTS },
};

// ------------------------------------------------------------ context ----

export interface StudentSnapshot {
  id: number;
  code: string;
  name: string | null;
  programId: number;
  admissionYear: number;
  isDualProgram: boolean;
  /** Main-semester number of the registration term (1–8+). */
  semester: number;
  /** Course year (курс), 1–4+. */
  year: number;
  gpa: number | null;
  earnedCredits: number;
  /** GPA of the last completed main semester. */
  lastTermGpa: number | null;
  /** Semester GPA ≤ 1.00 puts a student on the warning list (10.21). */
  onWarning: boolean;
  warningCount: number;
}

export interface TermSnapshot {
  id: number;
  code: string;
  type: TermType;
}

export interface CurriculumInfo extends CurriculumEntry {
  categoryCode: string;
  isElective: boolean;
}

export interface SelectionContext {
  student: StudentSnapshot;
  term: TermSnapshot;
  courses: Map<number, CatalogCourse>;
  offered: Set<number>;
  curriculum: Map<number, CurriculumInfo>;
  records: Map<number, CourseRecord>;
}

function studentFacts(s: StudentSnapshot) {
  return {
    code: s.code,
    semester: s.semester,
    year: s.year,
    gpa: s.gpa,
    earnedCredits: s.earnedCredits,
    lastTermGpa: s.lastTermGpa,
    onWarning: s.onWarning,
    warningCount: s.warningCount,
    isDualProgram: s.isDualProgram,
  };
}

function termFacts(t: TermSnapshot) {
  return { code: t.code, type: t.type, isMain: isMainTerm(t.type) };
}

export function courseLabel(course: Pick<CatalogCourse, 'code' | 'name'>): string {
  return `${course.code} ${course.name.mn}`;
}

// ------------------------------------------- Хичээл сонголт 1 (courses) ----

export function planSummary(ctx: SelectionContext, courseIds: number[]) {
  const list = courseIds.map((id) => ctx.courses.get(id)).filter((c): c is CatalogCourse => Boolean(c));
  const internshipCredits = list.filter((c) => c.isInternship).reduce((s, c) => s + c.credits, 0);
  const totalCredits = list.reduce((s, c) => s + c.credits, 0);
  return {
    courseCount: list.length,
    totalCredits,
    // Internships are not part of the semester load (9.6).
    loadCredits: totalCredits - internshipCredits,
    internshipCredits,
    courseCodes: list.map((c) => c.code),
  };
}

export type PrereqStatus = 'none' | 'met' | 'pending' | 'missing';

export interface PrereqState {
  status: PrereqStatus;
  /** Unsatisfied groups as "CS211/SE302" (alternatives joined by "/"). */
  missing: string[];
  /** Groups satisfied only by a course being taken right now. */
  pending: string[];
}

export function prerequisiteState(ctx: Pick<SelectionContext, 'courses' | 'records'>, course: CatalogCourse): PrereqState {
  const code = (id: number) => ctx.courses.get(id)?.code ?? `#${id}`;
  const missing: string[] = [];
  const pending: string[] = [];
  for (const group of course.prerequisiteGroups) {
    if (group.some((id) => ctx.records.get(id)?.passed)) continue;
    const running = group.filter((id) => ctx.records.get(id)?.inProgress);
    if (running.length > 0) pending.push(running.map(code).join('/'));
    else missing.push(group.map(code).join('/'));
  }
  const status: PrereqStatus =
    course.prerequisiteGroups.length === 0 ? 'none' : missing.length > 0 ? 'missing' : pending.length > 0 ? 'pending' : 'met';
  return { status, missing, pending };
}

export function selectionCourseFacts(ctx: SelectionContext, course: CatalogCourse) {
  const record = ctx.records.get(course.id);
  const cur = ctx.curriculum.get(course.id);
  const prereq = prerequisiteState(ctx, course);
  const number = Number(course.code.replace(/\D/g, '')) || 0;
  return {
    code: course.code,
    name: course.name.mn,
    credits: course.credits,
    level: Math.floor(number / 100) * 100,
    isInternship: course.isInternship,
    offered: ctx.offered.has(course.id),
    inCurriculum: Boolean(cur),
    category: cur?.categoryCode ?? null,
    isRequired: Boolean(cur && !cur.isElective),
    recommendedSemester: cur?.recommendedSemester ?? null,
    passed: record?.passed ?? false,
    bestLetter: record?.bestLetter ?? null,
    bestGradePoint: record?.bestPoint ?? null,
    attempts: record?.attempts ?? 0,
    inProgress: record?.inProgress ?? false,
    prereqStatus: prereq.status,
    missingPrerequisites: prereq.missing,
    pendingPrerequisites: prereq.pending,
  };
}

/**
 * Subjects for evaluating a plan: one `plan` subject plus one `course`
 * subject per course — or only for `focus` (catalog what-if for one course).
 */
export function selectionSubjects(ctx: SelectionContext, planIds: number[], focus?: number[]): Subject[] {
  const base = { student: studentFacts(ctx.student), term: termFacts(ctx.term), plan: planSummary(ctx, planIds) };
  const subjects: Subject[] = [{ kind: 'plan', facts: base }];
  for (const id of focus ?? planIds) {
    const course = ctx.courses.get(id);
    if (!course) continue;
    subjects.push({ kind: 'course', id, label: courseLabel(course), facts: { ...base, course: selectionCourseFacts(ctx, course) } });
  }
  return subjects;
}

// ------------------------------------- Хичээл сонголт 2 (times, teachers) ----

export interface SectionInfo extends TimedSection {
  code: string;
  type: SectionType;
  courseId: number;
  instructor: { id: number; name: string; title: string | null } | null;
}

export interface ScheduleContext {
  student: StudentSnapshot;
  term: TermSnapshot;
  courses: Map<number, CatalogCourse>;
  /** Courses from Хичээл сонголт 1. */
  selected: number[];
  sections: Map<number, SectionInfo>;
  /** Sections already in this student's timetable. */
  held: Set<number>;
}

export const COMPONENT_NAMES: Record<SectionType, { mn: string; en: string }> = {
  lecture: { mn: 'лекц', en: 'lecture' },
  seminar: { mn: 'семинар', en: 'seminar' },
  lab: { mn: 'лаборатори', en: 'lab' },
};

export function slotKey(courseId: number, type: SectionType): string {
  return `${courseId}:${type}`;
}

export function sectionLabel(ctx: Pick<ScheduleContext, 'courses'>, s: Pick<SectionInfo, 'courseId' | 'code'>): string {
  return `${ctx.courses.get(s.courseId)?.code ?? '?'} ${s.code}`;
}

function scheduleSummary(ctx: ScheduleContext, picks: SectionInfo[]) {
  const meetings: Meeting[] = picks.flatMap((p) => p.meetings);
  const perDay = new Map<number, number>();
  for (const m of meetings) perDay.set(m.dayOfWeek, (perDay.get(m.dayOfWeek) ?? 0) + 1);
  const completeCourses = ctx.selected.filter((id) =>
    (ctx.courses.get(id)?.components ?? []).every((type) => picks.some((p) => p.courseId === id && p.type === type))
  ).length;
  return {
    courseCount: ctx.selected.length,
    completeCourses,
    pickedSections: picks.length,
    campusDays: perDay.size,
    maxMeetingsPerDay: perDay.size ? Math.max(...perDay.values()) : 0,
  };
}

export function sectionFacts(ctx: ScheduleContext, section: SectionInfo, picks: SectionInfo[]) {
  // A pick replaces the student's other section of the same course component.
  const others = picks.filter((p) => p.id !== section.id && slotKey(p.courseId, p.type) !== slotKey(section.courseId, section.type));
  const clashes = conflictsWith(section, others);
  return {
    code: section.code,
    label: sectionLabel(ctx, section),
    type: section.type,
    courseCode: ctx.courses.get(section.courseId)?.code ?? null,
    courseSelected: ctx.selected.includes(section.courseId),
    instructor: section.instructor?.name ?? null,
    conflictCount: clashes.length,
    conflictsWith: clashes.map((c) => sectionLabel(ctx, c)),
  };
}

/**
 * Subjects for a timetable: the plan, every selected course (are all its
 * components picked?) and every section in `sectionIds` — the timetable
 * itself, or the timetable plus a candidate being picked.
 */
export function scheduleSubjects(ctx: ScheduleContext, pickIds: number[], focusSections?: number[]): Subject[] {
  const picks = pickIds.map((id) => ctx.sections.get(id)).filter((s): s is SectionInfo => Boolean(s));
  const base = { student: studentFacts(ctx.student), term: termFacts(ctx.term), plan: scheduleSummary(ctx, picks) };
  const subjects: Subject[] = [{ kind: 'plan', facts: base }];

  for (const courseId of ctx.selected) {
    const course = ctx.courses.get(courseId);
    if (!course) continue;
    const picked = course.components.filter((type) => picks.some((p) => p.courseId === courseId && p.type === type));
    const missing = course.components.filter((t) => !picked.includes(t));
    subjects.push({
      kind: 'course',
      id: courseId,
      label: courseLabel(course),
      facts: {
        ...base,
        course: {
          code: course.code,
          name: course.name.mn,
          requiredComponents: course.components,
          pickedComponents: picked,
          missingComponents: missing,
          missingComponentsMn: missing.map((t) => COMPONENT_NAMES[t].mn),
          missingComponentsEn: missing.map((t) => COMPONENT_NAMES[t].en),
        },
      },
    });
  }

  for (const id of focusSections ?? pickIds) {
    const section = ctx.sections.get(id);
    if (!section) continue;
    subjects.push({ kind: 'section', id, label: sectionLabel(ctx, section), facts: { ...base, section: sectionFacts(ctx, section, picks) } });
  }
  return subjects;
}
