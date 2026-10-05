/**
 * Academic term arithmetic. Codes look like "2027-spring". Within a calendar
 * year the order is winter (Jan) → spring (Feb–Jun) → summer → autumn
 * (Sep–Dec); autumn and spring are the main semesters (үндсэн улирал).
 */

export type TermType = 'winter' | 'spring' | 'summer' | 'autumn';

const ORDER: Record<TermType, number> = { winter: 0, spring: 1, summer: 2, autumn: 3 };
const TYPES: TermType[] = ['winter', 'spring', 'summer', 'autumn'];

export interface TermRef {
  year: number;
  type: TermType;
}

export function isMainTerm(type: TermType): boolean {
  return type === 'autumn' || type === 'spring';
}

export function termCode(term: TermRef): string {
  return `${term.year}-${term.type}`;
}

export function parseTermCode(code: string): TermRef {
  const [year, type] = code.split('-');
  if (!(type in ORDER) || !/^\d{4}$/.test(year)) throw new Error(`bad term code: ${code}`);
  return { year: Number(year), type: type as TermType };
}

/** Sortable number: 2027-spring → 20271. */
export function termSeq(term: TermRef): number {
  return term.year * 10 + ORDER[term.type];
}

export function nextTerm(term: TermRef): TermRef {
  const i = ORDER[term.type];
  return i === 3 ? { year: term.year + 1, type: 'winter' } : { year: term.year, type: TYPES[i + 1] };
}

/** The next main semester after `term` (autumn → spring → autumn …). */
export function nextMainTerm(term: TermRef): TermRef {
  let t = nextTerm(term);
  while (!isMainTerm(t.type)) t = nextTerm(t);
  return t;
}

/** Main semesters from admission (autumn of `admissionYear`) up to and including `term`. */
export function semesterNumber(admissionYear: number, term: TermRef): number {
  let count = 0;
  let t: TermRef = { year: admissionYear, type: 'autumn' };
  while (termSeq(t) <= termSeq(term)) {
    count += 1;
    t = nextMainTerm(t);
  }
  return count;
}

const NAMES_MN: Record<TermType, string> = { winter: 'өвөл', spring: 'хавар', summer: 'зун', autumn: 'намар' };
const NAMES_EN: Record<TermType, string> = { winter: 'Winter', spring: 'Spring', summer: 'Summer', autumn: 'Autumn' };

/** "2027 оны хавар" / "Spring 2027". */
export function termLabel(term: TermRef): { mn: string; en: string } {
  return { mn: `${term.year} оны ${NAMES_MN[term.type]}`, en: `${NAMES_EN[term.type]} ${term.year}` };
}
