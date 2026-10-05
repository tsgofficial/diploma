import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findConflicts, meetingsOverlap, Meeting, PERIODS, sectionsConflict, conflictsWith } from './timeslot';
import { gapMinutes, inWindow, scoreTimetable, Slot, suggestTimetables } from './generator';

const P = (no: number) => PERIODS[no - 1];
const at = (day: number, period: number, weekParity: Meeting['weekParity'] = 'all'): Meeting => ({
  dayOfWeek: day,
  startMinute: P(period).start,
  endMinute: P(period).end,
  weekParity,
});
const section = (id: number, ...meetings: Meeting[]) => ({ id, label: `S${id}`, meetings });

test('same day and overlapping time conflict', () => {
  assert.equal(meetingsOverlap(at(1, 2), at(1, 2)), true);
});

test('adjacent periods do not conflict (end is exclusive)', () => {
  const a: Meeting = { dayOfWeek: 1, startMinute: 600, endMinute: 690, weekParity: 'all' };
  const b: Meeting = { dayOfWeek: 1, startMinute: 690, endMinute: 780, weekParity: 'all' };
  assert.equal(meetingsOverlap(a, b), false);
});

test('different days never conflict', () => {
  assert.equal(meetingsOverlap(at(1, 2), at(2, 2)), false);
});

test('odd-week and even-week labs at the same time do not conflict', () => {
  assert.equal(meetingsOverlap(at(4, 5, 'odd'), at(4, 5, 'even')), false);
  assert.equal(meetingsOverlap(at(4, 5, 'odd'), at(4, 5, 'odd')), true);
  assert.equal(meetingsOverlap(at(4, 5, 'odd'), at(4, 5, 'all')), true);
});

test('a section never conflicts with itself', () => {
  const s = section(1, at(1, 1));
  assert.equal(sectionsConflict(s, s), false);
});

test('conflictsWith lists only the clashing sections', () => {
  const candidate = section(1, at(3, 3));
  const clash = conflictsWith(candidate, [section(2, at(3, 3)), section(3, at(3, 4)), section(4, at(5, 3))]);
  assert.deepEqual(clash.map((s) => s.id), [2]);
});

test('findConflicts (sweep) agrees with the pairwise check', () => {
  const sections = [
    section(1, at(1, 1), at(3, 2)),
    section(2, at(1, 1, 'odd')),
    section(3, at(1, 1, 'even')),
    section(4, at(3, 2), at(5, 5)),
    section(5, { dayOfWeek: 1, startMinute: 8 * 60, endMinute: 11 * 60, weekParity: 'all' }), // long lab
    section(6, at(2, 4)),
  ];
  const sweep = findConflicts(sections).map(([a, b]) => `${a.id}-${b.id}`).sort();
  const naive: string[] = [];
  for (let i = 0; i < sections.length; i++)
    for (let j = i + 1; j < sections.length; j++)
      if (sectionsConflict(sections[i], sections[j])) naive.push(`${sections[i].id}-${sections[j].id}`);
  assert.deepEqual(sweep, naive.sort());
  assert.deepEqual(sweep, ['1-2', '1-3', '1-4', '1-5', '2-5', '3-5']);
});

test('gapMinutes counts idle time between classes on the same day', () => {
  assert.equal(gapMinutes([at(1, 1), at(1, 3)]), P(3).start - P(1).end);
  assert.equal(gapMinutes([at(1, 1), at(2, 3)]), 0);
});

test('the generator returns only conflict-free timetables', () => {
  const slots: Slot[] = [
    { key: 'A:lecture', options: [section(1, at(1, 1)), section(2, at(2, 1))] },
    { key: 'B:lecture', options: [section(3, at(1, 1))] },
    { key: 'C:seminar', options: [section(4, at(2, 1)), section(5, at(3, 1))] },
  ];
  const result = suggestTimetables(slots, {}, { limit: 10 });
  assert.equal(result.exhaustive, true);
  // A must avoid Mon-1 (B is fixed there); A at Tue-1 forces C to Wed-1.
  assert.deepEqual(result.suggestions.map((s) => s.sectionIds), [[2, 3, 5]]);
});

test('a class component with no sections is reported, not silently skipped', () => {
  const result = suggestTimetables([{ key: 'A:lab', options: [] }], {});
  assert.deepEqual(result.blockedSlots, [{ key: 'A:lab', reason: 'none' }]);
  assert.equal(result.suggestions.length, 0);
});

test('a wished free day steers the ranking', () => {
  const slots: Slot[] = [{ key: 'A:lecture', options: [section(1, at(5, 2)), section(2, at(2, 2))] }];
  const best = suggestTimetables(slots, { freeDays: [5] }).suggestions[0];
  assert.deepEqual(best.sectionIds, [2]);
  assert.equal(best.breakdown.freeDayClasses, 0);
});

test('compact preference prefers back-to-back classes', () => {
  const slots: Slot[] = [
    { key: 'A:lecture', options: [section(1, at(1, 2))] },
    { key: 'B:lecture', options: [section(2, at(1, 6)), section(3, at(1, 3))] },
  ];
  assert.deepEqual(suggestTimetables(slots, { compact: true }).suggestions[0].sectionIds, [1, 3]);
});

test('scores are explainable', () => {
  const { breakdown } = scoreTimetable([section(1, at(1, 1)), section(2, at(1, 6))], { avoidEarly: true, timeOfDay: 'morning' });
  assert.equal(breakdown.earlyClasses, 1);
  assert.equal(breakdown.outsideWindow, 1); // the 16:00 class
  assert.equal(breakdown.campusDays, 1);
});

test('time windows follow the periods: morning 1–3, afternoon 4–5, evening 6–7', () => {
  assert.equal(inWindow(at(1, 3), 'morning'), true);
  assert.equal(inWindow(at(1, 4), 'morning'), false);
  assert.equal(inWindow(at(1, 5), 'afternoon'), true);
  assert.equal(inWindow(at(1, 6), 'evening'), true);
  assert.equal(inWindow(at(1, 2), 'any'), true);
});

test('"only evenings" keeps a working student out of daytime classes', () => {
  const slots: Slot[] = [
    { key: 'A:lecture', options: [section(1, at(1, 2)), section(2, at(1, 6))] },
    { key: 'B:lab', options: [section(3, at(2, 3)), section(4, at(3, 7))] },
  ];
  const result = suggestTimetables(slots, { timeOfDay: 'evening', timeStrict: true }, { limit: 10 });
  assert.deepEqual(result.suggestions.map((s) => s.sectionIds), [[2, 4]]);
  assert.equal(result.suggestions[0].breakdown.outsideWindow, 0);
});

test('a strict window with no matching section names the slot and the reason', () => {
  const slots: Slot[] = [
    { key: 'A:lecture', options: [section(1, at(1, 6))] },
    { key: 'B:lab', options: [section(2, at(2, 3)), section(3, at(4, 2))] },
  ];
  const result = suggestTimetables(slots, { timeOfDay: 'evening', timeStrict: true });
  assert.deepEqual(result.blockedSlots, [{ key: 'B:lab', reason: 'time' }]);
});

test('a free day that must stay free removes sections on it', () => {
  const slots: Slot[] = [{ key: 'A:lecture', options: [section(1, at(5, 2))] }];
  assert.deepEqual(suggestTimetables(slots, { freeDays: [5], freeDaysStrict: true }).blockedSlots, [{ key: 'A:lecture', reason: 'free_day' }]);
  // As a wish only, the Friday class is still offered — with a penalty.
  const soft = suggestTimetables(slots, { freeDays: [5] }).suggestions[0];
  assert.equal(soft.breakdown.freeDayClasses, 1);
});

test('several free days at once', () => {
  const slots: Slot[] = [{ key: 'A:lecture', options: [section(1, at(1, 2)), section(2, at(5, 2)), section(3, at(3, 2))] }];
  assert.deepEqual(suggestTimetables(slots, { freeDays: [1, 5] }).suggestions[0].sectionIds, [3]);
});

test('a soft time wish ranks matching timetables first without excluding others', () => {
  const slots: Slot[] = [{ key: 'A:lecture', options: [section(1, at(1, 6)), section(2, at(1, 2))] }];
  const result = suggestTimetables(slots, { timeOfDay: 'morning' }, { limit: 5 });
  assert.deepEqual(result.suggestions.map((s) => s.sectionIds[0]), [2, 1]);
});

test('branch-and-bound returns the same best timetable as exhaustive search', () => {
  // 6 slots × 4 options on random-ish periods; compare best penalty with brute force.
  const slots: Slot[] = Array.from({ length: 6 }, (_, s) => ({
    key: `C${s}:lecture`,
    options: Array.from({ length: 4 }, (_, o) => section(s * 10 + o, at(((s * 3 + o * 2) % 5) + 1, ((s + o * 3) % 7) + 1))),
  }));
  const prefs = { freeDays: [5], avoidEarly: true, compact: true, fewerDays: true, timeOfDay: 'morning' as const };
  const fast = suggestTimetables(slots, prefs, { limit: 1 }).suggestions[0];

  let bestPenalty = Infinity;
  const pick: ReturnType<typeof section>[] = [];
  (function brute(i: number) {
    if (i === slots.length) {
      bestPenalty = Math.min(bestPenalty, scoreTimetable(pick, prefs).penalty);
      return;
    }
    for (const o of slots[i].options) {
      if (pick.some((p) => sectionsConflict(p, o))) continue;
      pick.push(o as ReturnType<typeof section>);
      brute(i + 1);
      pick.pop();
    }
  })(0);
  assert.equal(fast.penalty, bestPenalty);
});
