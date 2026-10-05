/**
 * Class meetings and time-conflict detection.
 *
 * A meeting is a weekly interval on one weekday. Some labs run only on odd
 * or even weeks (сондгой / тэгш долоо хоног), so two meetings at the same
 * time do NOT clash when one is odd-week and the other even-week.
 */

export type WeekParity = 'all' | 'odd' | 'even';

export interface Meeting {
  /** 1 = Monday … 7 = Sunday. */
  dayOfWeek: number;
  /** Minutes after midnight; end is exclusive. */
  startMinute: number;
  endMinute: number;
  weekParity: WeekParity;
  room?: string | null;
}

export interface TimedSection {
  id: number;
  label: string;
  meetings: Meeting[];
}

/** MUST class periods ("цаг"); meetings are stored as minutes so any time works. */
export const PERIODS: ReadonlyArray<{ no: number; start: number; end: number }> = [
  { no: 1, start: 7 * 60 + 40, end: 9 * 60 + 10 },
  { no: 2, start: 9 * 60 + 20, end: 10 * 60 + 50 },
  { no: 3, start: 11 * 60, end: 12 * 60 + 30 },
  { no: 4, start: 12 * 60 + 40, end: 14 * 60 + 10 },
  { no: 5, start: 14 * 60 + 20, end: 15 * 60 + 50 },
  { no: 6, start: 16 * 60, end: 17 * 60 + 30 },
  { no: 7, start: 17 * 60 + 40, end: 19 * 60 + 10 },
];

export function formatMinute(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

export function parityOverlaps(a: WeekParity, b: WeekParity): boolean {
  return a === 'all' || b === 'all' || a === b;
}

export function meetingsOverlap(a: Meeting, b: Meeting): boolean {
  return (
    a.dayOfWeek === b.dayOfWeek &&
    a.startMinute < b.endMinute &&
    b.startMinute < a.endMinute &&
    parityOverlaps(a.weekParity, b.weekParity)
  );
}

export function sectionsConflict(a: TimedSection, b: TimedSection): boolean {
  if (a.id === b.id) return false;
  return a.meetings.some((m) => b.meetings.some((n) => meetingsOverlap(m, n)));
}

/** The sections in `others` that clash with `candidate`. */
export function conflictsWith<T extends TimedSection>(candidate: TimedSection, others: T[]): T[] {
  return others.filter((o) => sectionsConflict(candidate, o));
}

/**
 * Every clashing pair in a set of sections — a sweep over meetings sorted by
 * (day, start), comparing each meeting only with those still running.
 * O(n log n + k) for n meetings and k overlaps.
 */
export function findConflicts<T extends TimedSection>(sections: T[]): Array<[T, T]> {
  const events = sections
    .flatMap((section) => section.meetings.map((meeting) => ({ section, meeting })))
    .sort((a, b) => a.meeting.dayOfWeek - b.meeting.dayOfWeek || a.meeting.startMinute - b.meeting.startMinute);

  const pairs = new Map<string, [T, T]>();
  let active: typeof events = [];
  let day = -1;
  for (const event of events) {
    if (event.meeting.dayOfWeek !== day) {
      day = event.meeting.dayOfWeek;
      active = [];
    }
    active = active.filter((a) => a.meeting.endMinute > event.meeting.startMinute);
    for (const other of active) {
      if (other.section.id === event.section.id) continue;
      if (!parityOverlaps(other.meeting.weekParity, event.meeting.weekParity)) continue;
      const [x, y] = other.section.id < event.section.id ? [other.section, event.section] : [event.section, other.section];
      pairs.set(`${x.id}:${y.id}`, [x, y]);
    }
    active.push(event);
  }
  return [...pairs.values()];
}
