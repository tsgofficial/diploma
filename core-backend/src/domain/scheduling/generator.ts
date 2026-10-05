/**
 * Timetable suggestions for Хичээл сонголт 2.
 *
 * Each selected course needs one section per component (lecture, seminar,
 * lab). That is a constraint-satisfaction problem: variables = (course,
 * component) slots, domains = the sections offered for it, constraint = no
 * two chosen sections clash. It plans; seats are not checked. We solve it with depth-first backtracking:
 *
 *  - hard preferences shrink the domains first — "only evenings" (a working
 *    student) or "Friday must stay free" remove every section that breaks
 *    them, and a slot left empty is reported with the reason;
 *  - MRV ordering — slots with the fewest options are assigned first, so dead
 *    ends are found near the root;
 *  - forward checking — an option is only tried if it clashes with nothing
 *    already chosen;
 *  - branch-and-bound — penalties that can only grow as sections are added
 *    (classes outside the wished time of day, on a wished free day, early
 *    classes, number of campus days) form a lower bound; a branch whose bound
 *    is already worse than the K-th best complete timetable is cut.
 *
 * Complete timetables are scored by the soft preferences and the best K are
 * returned, each with a breakdown so the student can see *why* it ranked
 * where it did.
 */
import { Meeting, sectionsConflict, TimedSection } from './timeslot';

export interface Slot {
  key: string; // e.g. "12:lab"
  options: TimedSection[];
}

export type TimeOfDay = 'any' | 'morning' | 'afternoon' | 'evening';

export interface Preferences {
  /** When classes should be — e.g. evenings for a student who works days. */
  timeOfDay?: TimeOfDay;
  /** True: only sections inside that window. False: prefer them. */
  timeStrict?: boolean;
  /** Weekdays (1–6) to keep free, e.g. [5] for Friday. */
  freeDays?: number[];
  /** True: those days must stay free. False: prefer them free. */
  freeDaysStrict?: boolean;
  /** Penalise classes starting before 09:00. */
  avoidEarly?: boolean;
  /** Penalise idle time between classes on the same day ("цонх"). */
  compact?: boolean;
  /** Penalise every extra day on campus. */
  fewerDays?: boolean;
}

/** Time windows by the class periods: morning = periods 1–3, afternoon = 4–5, evening = 6–7. */
export const TIME_WINDOWS: Record<Exclude<TimeOfDay, 'any'>, { from: number; to: number }> = {
  morning: { from: 0, to: 12 * 60 + 30 },
  afternoon: { from: 12 * 60 + 30, to: 16 * 60 },
  evening: { from: 16 * 60, to: 24 * 60 },
};

export interface ScoreBreakdown {
  gapMinutes: number;
  campusDays: number;
  earlyClasses: number;
  outsideWindow: number;
  freeDayClasses: number;
}

export interface Suggestion {
  /** Chosen section per slot, in the input slot order. */
  sectionIds: number[];
  /** Lower is better. */
  penalty: number;
  breakdown: ScoreBreakdown;
}

/** Why a slot has nothing left to choose from. */
export type BlockReason = 'none' | 'time' | 'free_day';

export interface GeneratorResult {
  suggestions: Suggestion[];
  /** Slots with no usable section, and the filter that emptied them. */
  blockedSlots: Array<{ key: string; reason: BlockReason }>;
  /** Search nodes visited; `exhaustive` is false if the node budget ran out. */
  explored: number;
  exhaustive: boolean;
}

const EARLY_BEFORE = 9 * 60;

const WEIGHTS = {
  gapPerHour: 4,
  campusDay: 6,
  early: 5,
  outsideWindow: 12,
  freeDay: 30,
};

export function inWindow(m: Meeting, timeOfDay: TimeOfDay | undefined): boolean {
  if (!timeOfDay || timeOfDay === 'any') return true;
  const w = TIME_WINDOWS[timeOfDay];
  return m.startMinute >= w.from && m.endMinute <= w.to;
}

function meetingsOf(sections: TimedSection[]): Meeting[] {
  return sections.flatMap((s) => s.meetings);
}

/** Penalty terms that never decrease as more sections are added — safe as a bound. */
function monotonePenalty(meetings: Meeting[], prefs: Preferences): { penalty: number; parts: Omit<ScoreBreakdown, 'gapMinutes'> } {
  const freeDays = prefs.freeDays ?? [];
  const days = new Set(meetings.map((m) => m.dayOfWeek));
  const earlyClasses = meetings.filter((m) => m.startMinute < EARLY_BEFORE).length;
  const outsideWindow = meetings.filter((m) => !inWindow(m, prefs.timeOfDay)).length;
  const freeDayClasses = meetings.filter((m) => freeDays.includes(m.dayOfWeek)).length;
  let penalty = freeDayClasses * WEIGHTS.freeDay + outsideWindow * WEIGHTS.outsideWindow;
  if (prefs.avoidEarly) penalty += earlyClasses * WEIGHTS.early;
  if (prefs.fewerDays) penalty += days.size * WEIGHTS.campusDay;
  return { penalty, parts: { campusDays: days.size, earlyClasses, outsideWindow, freeDayClasses } };
}

/** Idle minutes between the first and last class of each day. */
export function gapMinutes(meetings: Meeting[]): number {
  const byDay = new Map<number, Meeting[]>();
  for (const m of meetings) byDay.set(m.dayOfWeek, [...(byDay.get(m.dayOfWeek) ?? []), m]);
  let total = 0;
  for (const list of byDay.values()) {
    const sorted = [...list].sort((a, b) => a.startMinute - b.startMinute);
    let end = sorted[0].endMinute;
    for (const m of sorted.slice(1)) {
      if (m.startMinute > end) total += m.startMinute - end;
      end = Math.max(end, m.endMinute);
    }
  }
  return total;
}

/** Score of a complete timetable. Breaks between consecutive periods (10 min) are not gaps worth counting. */
export function scoreTimetable(sections: TimedSection[], prefs: Preferences): { penalty: number; breakdown: ScoreBreakdown } {
  const meetings = meetingsOf(sections);
  const { penalty: base, parts } = monotonePenalty(meetings, prefs);
  const rawGap = gapMinutes(meetings);
  const meaningfulGap = Math.max(0, rawGap - 10 * Math.max(0, meetings.length - parts.campusDays));
  const penalty = base + (prefs.compact ? (meaningfulGap / 60) * WEIGHTS.gapPerHour : 0);
  return { penalty: Math.round(penalty * 10) / 10, breakdown: { gapMinutes: meaningfulGap, ...parts } };
}

/** Applies the hard preferences to one slot; reports which filter emptied it. */
function usableOptions(slot: Slot, prefs: Preferences): { options: TimedSection[]; reason: BlockReason | null } {
  if (slot.options.length === 0) return { options: [], reason: 'none' };
  const timed = prefs.timeStrict ? slot.options.filter((o) => o.meetings.every((m) => inWindow(m, prefs.timeOfDay))) : slot.options;
  if (timed.length === 0) return { options: [], reason: 'time' };
  const freeDays = prefs.freeDays ?? [];
  const free = prefs.freeDaysStrict && freeDays.length ? timed.filter((o) => o.meetings.every((m) => !freeDays.includes(m.dayOfWeek))) : timed;
  if (free.length === 0) return { options: [], reason: 'free_day' };
  return { options: free, reason: null };
}

export function suggestTimetables(
  slots: Slot[],
  prefs: Preferences,
  options: { limit?: number; maxNodes?: number } = {}
): GeneratorResult {
  const limit = options.limit ?? 5;
  const maxNodes = options.maxNodes ?? 200_000;

  const domains = slots.map((slot) => ({ slot, ...usableOptions(slot, prefs) }));
  const blockedSlots = domains.filter((d) => d.reason).map((d) => ({ key: d.slot.key, reason: d.reason as BlockReason }));
  if (blockedSlots.length > 0 || slots.length === 0) {
    return { suggestions: [], blockedSlots, explored: 0, exhaustive: true };
  }

  // MRV: fewest options first; within a slot, try individually cheaper options first.
  const order = domains
    .map((d, index) => ({
      index,
      options: [...d.options].sort(
        (a, b) => monotonePenalty(a.meetings, prefs).penalty - monotonePenalty(b.meetings, prefs).penalty
      ),
    }))
    .sort((a, b) => a.options.length - b.options.length);

  const best: Suggestion[] = [];
  const chosen: TimedSection[] = new Array(slots.length);
  let explored = 0;
  let exhaustive = true;

  const worstKept = () => (best.length < limit ? Infinity : best[best.length - 1].penalty);

  function record(): void {
    const sections = order.map((o) => chosen[o.index]);
    const { penalty, breakdown } = scoreTimetable(sections, prefs);
    if (penalty >= worstKept()) return;
    best.push({ sectionIds: slots.map((_, i) => chosen[i].id), penalty, breakdown });
    best.sort((a, b) => a.penalty - b.penalty);
    if (best.length > limit) best.pop();
  }

  function search(depth: number, picked: TimedSection[]): void {
    if (explored >= maxNodes) {
      exhaustive = false;
      return;
    }
    if (depth === order.length) {
      record();
      return;
    }
    const { index, options: candidates } = order[depth];
    for (const option of candidates) {
      explored += 1;
      if (picked.some((p) => sectionsConflict(p, option))) continue;
      const next = [...picked, option];
      if (monotonePenalty(meetingsOf(next), prefs).penalty >= worstKept()) continue;
      chosen[index] = option;
      search(depth + 1, next);
      if (explored >= maxNodes) {
        exhaustive = false;
        return;
      }
    }
  }

  search(0, []);
  return { suggestions: best, blockedSlots: [], explored, exhaustive };
}
