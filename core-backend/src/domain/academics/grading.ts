/**
 * Grading per ШУТИС тушаал №199, хүснэгт 10.2 (PDF p.16): 100-point score →
 * letter → grade point, and the GPA formula of clause 10.17
 * (ҮГД = Σ gradePoint·credits / Σ credits).
 */

export interface GradeBand {
  letter: string;
  min: number;
  max: number;
  point: number;
}

export const GRADE_SCALE: readonly GradeBand[] = [
  { letter: 'A+', min: 95, max: 100, point: 4.0 },
  { letter: 'A', min: 90, max: 94, point: 3.7 },
  { letter: 'B+', min: 87, max: 89, point: 3.3 },
  { letter: 'B', min: 83, max: 86, point: 3.0 },
  { letter: 'B-', min: 80, max: 82, point: 2.7 },
  { letter: 'C+', min: 77, max: 79, point: 2.3 },
  { letter: 'C', min: 73, max: 76, point: 2.0 },
  { letter: 'C-', min: 70, max: 72, point: 1.7 },
  { letter: 'D', min: 65, max: 69, point: 1.3 },
  { letter: 'D-', min: 60, max: 64, point: 1.0 },
  // Took part but did not pass (10.7.5).
  { letter: 'F', min: 0, max: 59, point: 0.5 },
];

/** Did not take part in the course (10.7.6) — counts as 0 in the GPA. */
export const NON_PARTICIPATION = { letter: 'WF', point: 0 } as const;

/** Withdrawn — no grade point, excluded from the GPA. */
export const WITHDRAWN = 'W';

export const PASSING_POINT = 1.0;

export function bandForScore(score: number): GradeBand {
  const rounded = Math.round(score);
  const band = GRADE_SCALE.find((b) => rounded >= b.min && rounded <= b.max);
  if (!band) throw new Error(`score out of range: ${score}`);
  return band;
}

/** Grade point for a letter, or null when the letter does not count (W). */
export function pointForLetter(letter: string): number | null {
  if (letter === NON_PARTICIPATION.letter) return NON_PARTICIPATION.point;
  if (letter === WITHDRAWN) return null;
  return GRADE_SCALE.find((b) => b.letter === letter)?.point ?? null;
}

export function isPassingLetter(letter: string): boolean {
  const point = pointForLetter(letter);
  return point !== null && point >= PASSING_POINT;
}

/** Credit-weighted GPA (10.17). Null when nothing counts yet. */
export function computeGpa(entries: Array<{ credits: number; point: number | null }>): number | null {
  const counted = entries.filter((e) => e.point !== null && e.credits > 0);
  const credits = counted.reduce((sum, e) => sum + e.credits, 0);
  if (credits === 0) return null;
  const weighted = counted.reduce((sum, e) => sum + (e.point as number) * e.credits, 0);
  return Math.round((weighted / credits) * 100) / 100;
}
