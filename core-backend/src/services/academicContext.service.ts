/**
 * Loads everything the rules, the audit and the planner need about one
 * student and one term — in a fixed number of queries, no N+1 — and maps the
 * rows into the plain shapes of the domain layer.
 */
import { Transaction } from 'sequelize';
import { catalogRepo, CourseWithPrereqs } from '../repos/catalog.repo';
import { gradeRepo, GradeWithTerm } from '../repos/grade.repo';
import { selectionRepo } from '../repos/selection.repo';
import { studentRepo, StudentWithUser } from '../repos/student.repo';
import { termRepo } from '../repos/term.repo';
import { TermModel } from '../models/term.model';
import { ProgramModel } from '../models/program.model';
import { auditDegree, AuditResult } from '../domain/academics/degreeAudit';
import { computeGpa } from '../domain/academics/grading';
import { isMainTerm, semesterNumber } from '../domain/academics/terms';
import { Attempt, CatalogCourse, CurriculumEntry, RequirementCategory } from '../domain/academics/types';
import { CurriculumInfo, StudentSnapshot, TermSnapshot } from '../domain/registration/facts';
import { createHttpError } from '../utils/httpError';

export interface AcademicContext {
  student: StudentWithUser;
  program: ProgramModel;
  term: TermModel;
  courses: Map<number, CatalogCourse>;
  categories: RequirementCategory[];
  curriculumEntries: CurriculumEntry[];
  curriculum: Map<number, CurriculumInfo>;
  /** Transcript rows before `term` (completed + in progress). */
  attempts: Attempt[];
  grades: GradeWithTerm[];
  offered: Set<number>;
  /** Хичээл сонголт 1 for `term`. */
  selected: number[];
  audit: AuditResult;
  snapshot: StudentSnapshot;
  termSnapshot: TermSnapshot;
}

export function toCatalogCourse(row: CourseWithPrereqs): CatalogCourse {
  const groups = new Map<number, number[]>();
  for (const p of row.prerequisites ?? []) groups.set(p.groupNo, [...(groups.get(p.groupNo) ?? []), p.prerequisiteId]);
  return {
    id: row.id,
    code: row.code,
    name: { mn: row.name, en: row.nameEn },
    credits: row.credits,
    isInternship: row.isInternship,
    termsOffered: row.termsOffered,
    components: row.components,
    prerequisiteGroups: [...groups.entries()].sort(([a], [b]) => a - b).map(([, ids]) => ids),
    tags: row.tags ?? [],
  };
}

function toAttempt(g: GradeWithTerm): Attempt {
  return {
    courseId: g.courseId,
    termCode: g.term?.code ?? '',
    termSeq: g.term?.seq ?? 0,
    letter: g.letter,
    point: g.gradePoint,
    passed: g.passed,
    status: g.status,
  };
}

/** Semester GPAs of completed main terms, oldest first (for the 10.21 warning list). */
export function termGpas(grades: GradeWithTerm[], courses: Map<number, CatalogCourse>) {
  const byTerm = new Map<number, { term: TermModel; entries: { credits: number; point: number | null }[] }>();
  for (const g of grades) {
    if (g.status !== 'completed' || !g.term) continue;
    const entry = byTerm.get(g.termId) ?? { term: g.term, entries: [] };
    entry.entries.push({ credits: courses.get(g.courseId)?.credits ?? 0, point: g.gradePoint });
    byTerm.set(g.termId, entry);
  }
  return [...byTerm.values()]
    .sort((a, b) => a.term.seq - b.term.seq)
    .map(({ term, entries }) => ({ term, gpa: computeGpa(entries), credits: entries.reduce((s, e) => s + e.credits, 0) }));
}

export async function resolveTerm(termId: number, t?: Transaction): Promise<TermModel> {
  const term = Number.isInteger(termId) ? await termRepo.findById(termId, t) : null;
  if (!term) throw createHttpError(404, 'term not found');
  return term;
}

export async function loadAcademicContext(studentId: number, term: TermModel, t?: Transaction): Promise<AcademicContext> {
  const student = await studentRepo.findById(studentId, t);
  if (!student) throw createHttpError(404, 'no student record', { code: 'no_student' });

  const [program, courseRows, categoryRows, curriculumRows, grades, offeredIds, selected] = await Promise.all([
    catalogRepo.program(student.programId, t),
    catalogRepo.courses(t),
    catalogRepo.categories(student.programId, t),
    catalogRepo.curriculum(student.programId, t),
    gradeRepo.listByStudent(student.id, t),
    catalogRepo.offeredCourseIds(term.id, t),
    selectionRepo.courseIds(student.id, term.id, t),
  ]);
  if (!program) throw createHttpError(500, 'student program missing');

  const courses = new Map(courseRows.map((c) => [c.id, toCatalogCourse(c)]));
  const categories: RequirementCategory[] = categoryRows.map((c) => ({
    id: c.id,
    code: c.code,
    name: { mn: c.name, en: c.nameEn },
    group: c.group,
    isElective: c.isElective,
    minCredits: c.minCredits,
    sortOrder: c.sortOrder,
  }));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const curriculumEntries: CurriculumEntry[] = curriculumRows.map((c) => ({
    courseId: c.courseId,
    categoryId: c.categoryId,
    recommendedSemester: c.recommendedSemester,
  }));
  const curriculum = new Map<number, CurriculumInfo>(
    curriculumEntries.map((c) => {
      const category = categoryById.get(c.categoryId);
      return [c.courseId, { ...c, categoryCode: category?.code ?? '', isElective: category?.isElective ?? true }];
    })
  );

  const before = grades.filter((g) => (g.term?.seq ?? 0) < term.seq);
  const attempts = before.map(toAttempt);
  const audit = auditDegree({
    totalCredits: program.totalCredits,
    categories,
    curriculum: curriculumEntries,
    courses,
    attempts,
    planned: selected,
  });

  const mainTermGpas = termGpas(before, courses).filter((x) => isMainTerm(x.term.type) && x.gpa !== null);
  const last = mainTermGpas[mainTermGpas.length - 1];
  const semester = semesterNumber(student.admissionYear, { year: term.year, type: term.type });
  const snapshot: StudentSnapshot = {
    id: student.id,
    code: student.studentCode,
    name: student.user?.name ?? null,
    programId: student.programId,
    admissionYear: student.admissionYear,
    isDualProgram: student.isDualProgram,
    semester,
    year: Math.max(1, Math.ceil(semester / 2)),
    gpa: audit.gpa,
    earnedCredits: audit.totals.earned,
    lastTermGpa: last?.gpa ?? null,
    onWarning: last ? (last.gpa as number) <= 1.0 : false,
    warningCount: mainTermGpas.filter((x) => (x.gpa as number) <= 1.0).length,
  };

  return {
    student,
    program,
    term,
    courses,
    categories,
    curriculumEntries,
    curriculum,
    attempts,
    grades,
    offered: new Set(offeredIds),
    selected,
    audit,
    snapshot,
    termSnapshot: { id: term.id, code: term.code, type: term.type },
  };
}

// ---------------------------------------------------------------- DTOs ----

export function termDto(term: TermModel) {
  return {
    id: term.id,
    code: term.code,
    type: term.type,
    year: term.year,
    name: { mn: term.name, en: term.nameEn },
    phase: term.phase,
    isCurrent: term.isCurrent,
    selectionOpensAt: term.selectionOpensAt,
    selectionClosesAt: term.selectionClosesAt,
    scheduleOpensAt: term.scheduleOpensAt,
    scheduleClosesAt: term.scheduleClosesAt,
  };
}

export function studentDto(ac: AcademicContext) {
  const s = ac.snapshot;
  return {
    code: s.code,
    name: s.name,
    email: ac.student.user?.email ?? null,
    program: { code: ac.program.code, name: { mn: ac.program.name, en: ac.program.nameEn }, school: ac.program.school, totalCredits: ac.program.totalCredits },
    admissionYear: s.admissionYear,
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
