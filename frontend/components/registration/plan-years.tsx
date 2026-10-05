'use client';

import { Chip } from '@heroui/react';
import { GraduationCap, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useLocalized } from '@/lib/registration';
import type { Localized, PlanState } from '@/lib/api';

type PlanTerm = PlanState['terms'][number];
type HistoryTerm = PlanState['history'][number];
type Season = 'autumn' | 'spring' | 'summer';

/** A semester box: already behind the student, underway, or planned. */
type Cell = { kind: 'past' | 'current'; term: HistoryTerm } | { kind: 'plan'; term: PlanTerm };

interface YearRow {
  /** Calendar year the academic year starts in (autumn). */
  start: number;
  courseYear: number | null;
  credits: number;
  cells: Partial<Record<Season, Cell>>;
}

/** Autumn Y, spring Y+1 and summer Y+1 form one academic year. */
function academicStart(term: { code: string; type: string }): number {
  const year = Number(term.code.slice(0, 4));
  return term.type === 'autumn' ? year : year - 1;
}

function groupByYear(cells: Cell[]): YearRow[] {
  const rows = new Map<number, YearRow>();
  for (const cell of cells) {
    const { term } = cell;
    if (term.type === 'winter') continue;
    const start = academicStart(term);
    const row = rows.get(start) ?? { start, courseYear: null, credits: 0, cells: {} };
    row.cells[term.type as Season] = cell;
    row.credits += term.credits;
    if (term.semester) row.courseYear = Math.ceil(term.semester / 2);
    rows.set(start, row);
  }
  return [...rows.values()].sort((a, b) => a.start - b.start);
}

/** A semester already behind the student, or the one underway: what it holds, nothing more. */
function HistoryCell({ cell }: { cell: { kind: 'past' | 'current'; term: HistoryTerm } }) {
  const t = useTranslations('registration.plan');
  const l = useLocalized();
  const { term } = cell;
  const past = cell.kind === 'past';
  return (
    <div className={`flex h-full flex-col rounded-2xl border p-3 ${past ? 'border-separator/70 bg-default/40 text-muted' : 'border-separator bg-surface'}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`font-medium ${past ? '' : 'text-foreground'}`}>{l(term.name)}</span>
        <span className="text-sm tabular-nums text-muted">{t('credits', { n: term.loadCredits })}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {term.semester && (
          <Chip size="sm" variant="soft">
            {t('semester', { n: term.semester })}
          </Chip>
        )}
        {!past && (
          <Chip size="sm" variant="soft" color="warning">
            {t('current')}
          </Chip>
        )}
      </div>
      {term.courses.length === 0 ? (
        <p className="mt-3 text-sm">—</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {term.courses.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-sm leading-snug">
              <span className="w-16 shrink-0 font-mono text-xs font-semibold leading-5">{c.code}</span>
              <span className="min-w-0 flex-1">{l(c.name)}</span>
              <span className="shrink-0 text-xs tabular-nums leading-5 text-muted">{c.credits}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TermCell({ term, graduation, interestName }: { term: PlanTerm; graduation: boolean; interestName: (key: string) => string }) {
  const t = useTranslations('registration.plan');
  const l = useLocalized();
  return (
    <div
      className={`flex h-full flex-col rounded-2xl border p-3 ${
        term.isRegistrationTerm
          ? 'border-accent/60 bg-accent-soft/30'
          : graduation
            ? 'border-success/60 bg-success-soft/30'
            : term.light
              ? 'border-separator bg-default/40'
              : term.type === 'summer'
                ? 'border-dashed border-separator'
                : 'border-separator bg-surface'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{l(term.name)}</span>
        <span className={`text-sm tabular-nums ${term.overPreferred ? 'text-warning' : 'text-muted'}`} title={term.overPreferred ? t('overPreferred') : undefined}>
          {t('credits', { n: term.loadCredits })}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {term.semester && (
          <Chip size="sm" variant="soft">
            {t('semester', { n: term.semester })}
          </Chip>
        )}
        {term.isRegistrationTerm && (
          <Chip size="sm" variant="soft" color="accent">
            {t('now')}
          </Chip>
        )}
        {term.light && <Chip size="sm" variant="soft">{t('lightBadge')}</Chip>}
        {graduation && (
          <Chip size="sm" variant="soft" color="success">
            <GraduationCap className="size-3" />
            {t('graduationTerm')}
          </Chip>
        )}
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {term.courses.map((c) => (
          <li key={c.id} className="text-sm leading-snug">
            <div className="flex items-start gap-2">
              <span className="w-16 shrink-0 font-mono text-xs font-semibold leading-5">{c.code}</span>
              <span className="min-w-0 flex-1">{l(c.name)}</span>
              {c.forced && <Lock className="mt-1 size-3 shrink-0 text-muted" aria-label={t('forced')} />}
              <span className="shrink-0 text-xs tabular-nums leading-5 text-muted">{c.credits}</span>
            </div>
            {(c.reason !== 'required' || c.interests.length > 0) && (
              <div className="ml-[4.5rem] text-[11px] text-muted">
                {t(`reasons.${c.reason}`)}
                {c.interests.length > 0 && <span className="text-accent"> · {c.interests.map(interestName).join(', ')}</span>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The plan as a table of years: one row per course year, autumn / spring /
 * summer side by side — from the first year (semesters already behind the
 * student, greyed) to graduation, on one screen.
 */
export function PlanYears({ plan, interests }: { plan: PlanState; interests: Array<{ key: string; name: Localized }> }) {
  const t = useTranslations('registration.plan');
  const l = useLocalized();
  const cells: Cell[] = [
    ...plan.history.map((term) => ({ kind: term.status, term }) as Cell),
    ...plan.terms.map((term) => ({ kind: 'plan', term }) as Cell),
  ];
  const rows = groupByYear(cells);
  const withSummer = cells.some((c) => c.term.type === 'summer');
  const seasons: Season[] = withSummer ? ['autumn', 'spring', 'summer'] : ['autumn', 'spring'];
  const last = plan.terms[plan.terms.length - 1]?.code;
  const graduationCode = plan.graduationTerm ? last : null;
  const interestName = (key: string) => l(interests.find((i) => i.key === key)?.name);
  const cols = withSummer ? 'lg:grid-cols-[8.5rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.85fr)]' : 'lg:grid-cols-[8.5rem_minmax(0,1fr)_minmax(0,1fr)]';

  return (
    <div className="flex flex-col gap-3">
      <div className={`hidden gap-3 px-1 text-xs font-medium uppercase tracking-wide text-muted lg:grid ${cols}`}>
        <span />
        {seasons.map((s) => (
          <span key={s}>{t(`seasons.${s}`)}</span>
        ))}
      </div>
      {rows.map((row) => (
        <div key={row.start} className={`grid gap-3 rounded-2xl lg:items-stretch ${cols}`}>
          <div className="flex items-baseline gap-2 px-1 lg:flex-col lg:gap-0.5 lg:pt-3">
            <span className="text-lg font-semibold">{row.courseYear ? t('courseYear', { n: row.courseYear }) : '—'}</span>
            <span className="text-xs text-muted">{t('academicYear', { from: row.start, to: row.start + 1 })}</span>
            <span className="text-xs tabular-nums text-muted">{t('credits', { n: row.credits })}</span>
          </div>
          {seasons.map((s) => {
            const cell = row.cells[s];
            return cell ? (
              cell.kind === 'plan' ? (
                <TermCell key={s} term={cell.term} graduation={cell.term.code === graduationCode} interestName={interestName} />
              ) : (
                <HistoryCell key={s} cell={cell} />
              )
            ) : (
              <div key={s} className="hidden rounded-2xl border border-dashed border-separator/70 lg:block" aria-hidden />
            );
          })}
        </div>
      ))}
    </div>
  );
}
