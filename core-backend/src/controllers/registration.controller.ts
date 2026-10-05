/**
 * Student helper — the graduation plan, the curriculum, and Хичээл сонголт 2
 * (class times). Thin HTTP adapter:
 * validates input at the edge, delegates to the services.
 */
import { Request, Response, NextFunction } from 'express';
import { scheduleService } from '../services/schedule.service';
import { DEFAULT_PLAN_PREFERENCES, progressService } from '../services/progress.service';
import { termService } from '../services/term.service';
import { ruleService } from '../services/rule.service';
import { termDto } from '../services/academicContext.service';
import { studentRepo } from '../repos/student.repo';
import { PERIODS } from '../domain/scheduling/timeslot';
import type { Preferences, TimeOfDay } from '../domain/scheduling/generator';
import type { PlanPreferences } from '../domain/academics/planner';
import { INTEREST_KEYS } from '../domain/registration/interests';
import { createHttpError } from '../utils/httpError';

function positiveInt(value: unknown, name: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw createHttpError(400, `${name} must be a positive integer`);
  return n;
}

function intList(value: unknown, name: string, max = 60): number[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max) throw createHttpError(400, `${name} must be a list of at most ${max} ids`);
  return value.map((v) => positiveInt(v, name));
}

const TIMES_OF_DAY: TimeOfDay[] = ['any', 'morning', 'afternoon', 'evening'];

function dayList(value: unknown, name: string): number[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 6) throw createHttpError(400, `${name} must be a list of weekdays`);
  const days = value.map(Number);
  if (days.some((d) => !Number.isInteger(d) || d < 1 || d > 6)) throw createHttpError(400, `${name} must hold weekdays 1–6`);
  return [...new Set(days)];
}

/** Timetable wishes for Хичээл сонголт 2. */
function preferences(body: Record<string, unknown>): Preferences {
  const timeOfDay = (body.timeOfDay ?? 'any') as TimeOfDay;
  if (!TIMES_OF_DAY.includes(timeOfDay)) throw createHttpError(400, `timeOfDay must be one of ${TIMES_OF_DAY.join(', ')}`);
  const flag = (key: string) => body[key] === true;
  return {
    timeOfDay,
    timeStrict: flag('timeStrict'),
    freeDays: dayList(body.freeDays, 'freeDays'),
    freeDaysStrict: flag('freeDaysStrict'),
    avoidEarly: flag('avoidEarly'),
    compact: flag('compact'),
    fewerDays: flag('fewerDays'),
  };
}

/** Planning wishes for the graduation plan. */
function planPreferences(body: Record<string, unknown>): PlanPreferences {
  const d = DEFAULT_PLAN_PREFERENCES;
  const target = body.targetSemesters === undefined || body.targetSemesters === null ? null : Number(body.targetSemesters);
  if (target !== null && !(Number.isInteger(target) && target >= 1 && target <= 14)) throw createHttpError(400, 'targetSemesters must be 1–14');
  const maxLoad = body.maxLoad === undefined ? d.maxLoad : Number(body.maxLoad);
  if (!Number.isInteger(maxLoad) || maxLoad < 3 || maxLoad > 30) throw createHttpError(400, 'maxLoad must be 3–30');
  const light = body.lightSemesters === undefined ? [] : body.lightSemesters;
  if (!Array.isArray(light) || light.length > 14 || light.some((x) => !Number.isInteger(x) || x < 1 || x > 14)) {
    throw createHttpError(400, 'lightSemesters must be a list of semester numbers');
  }
  const interests = Array.isArray(body.interests) ? body.interests.filter((x): x is string => typeof x === 'string' && INTEREST_KEYS.includes(x)) : [];
  return {
    targetSemesters: target,
    allowSummer: body.allowSummer === true,
    maxLoad,
    lightSemesters: [...new Set(light as number[])],
    interests: [...new Set(interests)],
    keepSelection: body.keepSelection === undefined ? d.keepSelection : body.keepSelection === true,
  };
}

/** Wraps an async handler so thrown errors reach the error middleware. */
function handle(fn: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = await fn(req, res);
      if (!res.headersSent) res.json(body);
    } catch (err) {
      next(err);
    }
  };
}

const sid = (req: Request) => req.studentId as number;
const uid = (req: Request) => req.userId as string;
const termId = (req: Request) => positiveInt(req.params.termId, 'termId');

export const registrationController = {
  /** GET /api/registration/current — the open term, class periods, and whether the caller is a student. */
  current: handle(async (req) => {
    const [term, student] = await Promise.all([termService.current(), studentRepo.findByUserId(uid(req))]);
    return { term: termDto(term), periods: PERIODS, hasStudent: Boolean(student) };
  }),

  /** GET /api/registration/rules — enabled rules with their sources (transparency for students). */
  rules: handle(async () => ({ rules: await ruleService.list(false) })),

  schedule: handle((req) => scheduleService.getState(sid(req), termId(req))),

  pickSection: handle((req) => scheduleService.pick(uid(req), sid(req), termId(req), positiveInt(req.body?.sectionId, 'sectionId'))),

  dropSection: handle((req) => scheduleService.unpick(uid(req), sid(req), termId(req), positiveInt(req.params.sectionId, 'sectionId'))),

  suggest: handle((req) => scheduleService.suggest(sid(req), termId(req), preferences(req.body ?? {}))),

  apply: handle((req) => {
    const ids = intList(req.body?.sectionIds, 'sectionIds');
    if (ids.length === 0) throw createHttpError(400, 'sectionIds is required');
    return scheduleService.apply(uid(req), sid(req), termId(req), ids);
  }),

  curriculum: handle((req) => progressService.getCurriculum(sid(req))),

  planOptions: handle((req) => progressService.getPlanOptions(sid(req))),

  plan: handle((req) => progressService.getPlan(sid(req), planPreferences(req.body ?? {}))),
};
