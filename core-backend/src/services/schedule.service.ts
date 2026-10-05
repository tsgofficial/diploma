/**
 * Хичээл сонголт 2 — planning class times and teachers.
 *
 * The student builds a timetable plan from the class groups on offer; seats
 * are not reserved or checked (registering happens in the university's own
 * system), at any time — it does not wait for the registration phase. Each
 * change runs in a transaction that locks the student's row, so
 * one student's simultaneous requests (two tabs, a double click) cannot
 * produce a clashing timetable; the rules (time conflicts, components…) are
 * evaluated on that locked state.
 */
import { Transaction } from 'sequelize';
import { sequelize } from '../config/database';
import { studentRepo } from '../repos/student.repo';
import { sectionRepo, SectionFull } from '../repos/section.repo';
import { enrollmentRepo } from '../repos/enrollment.repo';
import { auditRepo } from '../repos/audit.repo';
import { TermModel } from '../models/term.model';
import { SectionEnrollmentModel } from '../models/sectionEnrollment.model';
import { ruleService } from './rule.service';
import { AcademicContext, loadAcademicContext, resolveTerm, studentDto, termDto } from './academicContext.service';
import { evaluateRules, Evaluation, RuleOutcome } from '../domain/rule-engine';
import { CatalogCourse } from '../domain/academics/types';
import {
  courseLabel,
  ScheduleContext,
  scheduleSubjects,
  sectionFacts,
  SectionInfo,
  slotKey,
} from '../domain/registration/facts';
import { Preferences, Slot, suggestTimetables } from '../domain/scheduling/generator';
import { PERIODS } from '../domain/scheduling/timeslot';
import { createHttpError } from '../utils/httpError';

function toSectionInfo(row: SectionFull, courses: Map<number, CatalogCourse>): SectionInfo {
  return {
    id: row.id,
    label: `${courses.get(row.courseId)?.code ?? '?'} ${row.code}`,
    code: row.code,
    type: row.type,
    courseId: row.courseId,
    instructor: row.instructor ? { id: row.instructor.id, name: row.instructor.name, title: row.instructor.title } : null,
    meetings: (row.meetings ?? [])
      .map((m) => ({ dayOfWeek: m.dayOfWeek, startMinute: m.startMinute, endMinute: m.endMinute, weekParity: m.weekParity, room: m.room }))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute),
  };
}

interface ScheduleLoad {
  ac: AcademicContext;
  ctx: ScheduleContext;
  enrollments: SectionEnrollmentModel[];
}

async function loadSchedule(studentId: number, term: TermModel, t?: Transaction, extraCourseIds: number[] = []): Promise<ScheduleLoad> {
  const ac = await loadAcademicContext(studentId, term, t);
  const enrollments = await enrollmentRepo.listByStudentTerm(studentId, term.id, t);
  const courseIds = [...new Set([...ac.selected, ...enrollments.map((e) => e.courseId), ...extraCourseIds])];
  const rows = await sectionRepo.listForCourses(term.id, courseIds, t);
  const ctx: ScheduleContext = {
    student: ac.snapshot,
    term: ac.termSnapshot,
    courses: ac.courses,
    selected: ac.selected,
    sections: new Map(rows.map((r) => [r.id, toSectionInfo(r, ac.courses)])),
    held: new Set(enrollments.map((e) => e.sectionId)),
  };
  return { ac, ctx, enrollments };
}

function sectionDto(ctx: ScheduleContext, s: SectionInfo, picks: SectionInfo[]) {
  const facts = sectionFacts(ctx, s, picks);
  const course = ctx.courses.get(s.courseId);
  return {
    id: s.id,
    code: s.code,
    type: s.type,
    courseId: s.courseId,
    courseCode: course?.code ?? null,
    courseName: course?.name ?? null,
    instructor: s.instructor,
    meetings: s.meetings,
    picked: ctx.held.has(s.id),
    conflictsWith: facts.conflictsWith,
  };
}

/** Errors that block a change: plan-level ones and those about the sections being taken. */
function blockingFor(evaluation: Evaluation, sectionIds: number[]): RuleOutcome[] {
  return evaluation.errors.filter((o) => o.subject.kind === 'plan' || (o.subject.kind === 'section' && sectionIds.includes(Number(o.subject.id))));
}

async function buildState(studentId: number, termId: number) {
  const term = await resolveTerm(termId);
  const { ac, ctx, enrollments } = await loadSchedule(studentId, term);
  const rules = await ruleService.forPhase('schedule');
  const pickIds = enrollments.map((e) => e.sectionId);
  const picks = pickIds.map((id) => ctx.sections.get(id)).filter((s): s is SectionInfo => Boolean(s));
  const evaluation = evaluateRules(rules, scheduleSubjects(ctx, pickIds));
  const all = [...ctx.sections.values()];

  const courses = ac.selected.map((courseId) => {
    const course = ac.courses.get(courseId)!;
    return {
      id: course.id,
      code: course.code,
      name: course.name,
      credits: course.credits,
      isInternship: course.isInternship,
      components: course.components.map((type) => ({
        type,
        pickedSectionId: picks.find((p) => p.courseId === courseId && p.type === type)?.id ?? null,
        options: all.filter((s) => s.courseId === courseId && s.type === type).map((s) => sectionDto(ctx, s, picks)),
      })),
      issues: [...evaluation.errors, ...evaluation.warnings].filter((o) => o.subject.kind === 'course' && o.subject.id === courseId),
    };
  });

  return {
    term: termDto(term),
    student: studentDto(ac),
    periods: PERIODS,
    courses,
    picks: picks.map((p) => sectionDto(ctx, p, picks)),
    summary: {
      courseCount: ac.selected.length,
      completeCourses: courses.filter((c) => c.components.every((x) => x.pickedSectionId !== null)).length,
      pickedSections: picks.length,
    },
    evaluation,
  };
}

async function recordAudit(userId: string, action: string, target: string, meta: Record<string, unknown>) {
  await auditRepo.record({ userId, action, target, meta });
}

export const scheduleService = {
  getState: buildState,

  async pick(userId: string, studentId: number, termId: number, sectionId: number) {
    // Loaded before the transaction: a query outside `t` while holding a pooled
    // connection could starve the pool under load (every connection waiting for one more).
    const rules = await ruleService.forPhase('schedule');
    const done = await sequelize.transaction(async (t) => {
      await studentRepo.lock(studentId, t);
      const term = await resolveTerm(termId, t);

      const target = await sectionRepo.findById(sectionId, t);
      if (!target || target.termId !== term.id) throw createHttpError(404, 'section not found');
      const { ctx, enrollments } = await loadSchedule(studentId, term, t, [target.courseId]);
      if (ctx.held.has(sectionId)) throw createHttpError(409, 'section already picked', { code: 'already_picked' });

      const replaced = enrollments.find((e) => slotKey(e.courseId, e.sectionType) === slotKey(target.courseId, target.type));

      const pickIds = [...enrollments.map((e) => e.sectionId).filter((id) => id !== replaced?.sectionId), sectionId];
      const evaluation = evaluateRules(rules, scheduleSubjects(ctx, pickIds, [sectionId]));
      const blocking = blockingFor(evaluation, [sectionId]);
      if (blocking.length) {
        throw createHttpError(422, 'registration rules not met', {
          code: 'rule_violation',
          evaluation: { ...evaluation, allowed: false, errors: blocking },
        });
      }

      if (replaced) await enrollmentRepo.removeSections(studentId, [replaced.sectionId], t);
      await enrollmentRepo.create(
        { studentId, termId: term.id, sectionId, courseId: target.courseId, sectionType: target.type },
        t
      );
      return { label: ctx.sections.get(sectionId)?.label ?? String(sectionId), replaced: replaced?.sectionId ?? null, term: term.code };
    });
    await recordAudit(userId, 'schedule.pick', done.label, { term: done.term, replacedSectionId: done.replaced });
    return buildState(studentId, termId);
  },

  async unpick(userId: string, studentId: number, termId: number, sectionId: number) {
    const term = await sequelize.transaction(async (t) => {
      await studentRepo.lock(studentId, t);
      const found = await resolveTerm(termId, t);
      const enrollments = await enrollmentRepo.listByStudentTerm(studentId, found.id, t);
      if (!enrollments.some((e) => e.sectionId === sectionId)) throw createHttpError(404, 'section is not in your timetable');
      await enrollmentRepo.removeSections(studentId, [sectionId], t);
      return found;
    });
    await recordAudit(userId, 'schedule.drop', String(sectionId), { term: term.code });
    return buildState(studentId, termId);
  },

  /** Ranked conflict-free timetables for the selected courses (read-only). */
  async suggest(studentId: number, termId: number, prefs: Preferences) {
    const term = await resolveTerm(termId);
    const { ctx } = await loadSchedule(studentId, term);
    const all = [...ctx.sections.values()];
    const slots: Slot[] = ctx.selected.flatMap((courseId) =>
      (ctx.courses.get(courseId)?.components ?? []).map((type) => ({
        key: slotKey(courseId, type),
        options: all.filter((s) => s.courseId === courseId && s.type === type),
      }))
    );

    const started = Date.now();
    const strict = suggestTimetables(slots, prefs, { limit: 5 });
    // No dead ends: when a must cannot be met, still recommend — the closest timetables with the musts
    // treated as (heavily weighted) wishes — and say which must failed and why.
    let result = strict;
    let relaxed = false;
    const mustFailed = strict.suggestions.length === 0 && strict.blockedSlots.some((b) => b.reason !== 'none');
    if (mustFailed && (prefs.timeStrict || prefs.freeDaysStrict)) {
      const soft = suggestTimetables(slots, { ...prefs, timeStrict: false, freeDaysStrict: false }, { limit: 5 });
      if (soft.suggestions.length > 0) {
        result = { ...soft, blockedSlots: strict.blockedSlots };
        relaxed = true;
      }
    }
    const held = [...ctx.held];
    return {
      suggestions: result.suggestions.map((s) => {
        const sections = s.sectionIds.map((id) => ctx.sections.get(id)!);
        return {
          sectionIds: s.sectionIds,
          penalty: s.penalty,
          breakdown: s.breakdown,
          changes: s.sectionIds.filter((id) => !held.includes(id)).length,
          sections: sections.map((sec) => sectionDto(ctx, sec, sections)),
        };
      }),
      // Why a class component has no option left, and when it does meet — so the student can relax a wish.
      blockedSlots: result.blockedSlots.map(({ key, reason }) => {
        const [courseId, type] = key.split(':');
        const course = ctx.courses.get(Number(courseId));
        const slot = slots.find((x) => x.key === key)!;
        return {
          courseId: Number(courseId),
          courseLabel: course ? courseLabel(course) : key,
          type,
          reason,
          meetings: slot.options.flatMap((o) => o.meetings),
        };
      }),
      relaxed,
      explored: result.explored,
      exhaustive: result.exhaustive,
      tookMs: Date.now() - started,
    };
  },

  /** Take a whole suggested timetable at once — all sections or none. */
  async apply(userId: string, studentId: number, termId: number, sectionIds: number[]) {
    const rules = await ruleService.forPhase('schedule');
    const done = await sequelize.transaction(async (t) => {
      await studentRepo.lock(studentId, t);
      const term = await resolveTerm(termId, t);
      const { ctx, enrollments } = await loadSchedule(studentId, term, t);

      const wanted = [...new Set(sectionIds)].map((id) => ctx.sections.get(id));
      if (wanted.some((s) => !s)) throw createHttpError(400, 'unknown section in timetable');
      const slots = (wanted as SectionInfo[]).map((s) => slotKey(s.courseId, s.type));
      if (new Set(slots).size !== slots.length) throw createHttpError(400, 'two sections for the same class component');

      const current = enrollments.map((e) => e.sectionId);
      const kept = enrollments.filter((e) => !slots.includes(slotKey(e.courseId, e.sectionType))).map((e) => e.sectionId);
      const toRemove = current.filter((id) => !kept.includes(id) && !sectionIds.includes(id));
      const toAdd = sectionIds.filter((id) => !current.includes(id));

      const finalPicks = [...kept, ...sectionIds];
      const evaluation = evaluateRules(rules, scheduleSubjects(ctx, finalPicks, toAdd));
      const blocking = blockingFor(evaluation, toAdd);
      if (blocking.length) {
        throw createHttpError(422, 'registration rules not met', {
          code: 'rule_violation',
          evaluation: { ...evaluation, allowed: false, errors: blocking },
        });
      }

      await enrollmentRepo.removeSections(studentId, toRemove, t);
      for (const id of toAdd) {
        const s = ctx.sections.get(id)!;
        await enrollmentRepo.create({ studentId, termId: term.id, sectionId: id, courseId: s.courseId, sectionType: s.type }, t);
      }
      return { term: term.code, added: toAdd.length, removed: toRemove.length };
    });
    await recordAudit(userId, 'schedule.apply', done.term, done);
    return buildState(studentId, termId);
  },
};
