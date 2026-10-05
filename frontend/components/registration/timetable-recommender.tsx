'use client';

import { Button, Card, Chip, Spinner, toast } from '@heroui/react';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { RuleIssues } from './rule-issues';
import { WeekGrid, type GridBlock } from './week-grid';
import { formatRange } from '@/lib/registration';
import {
  registrationApi,
  violationOf,
  type Period,
  type Preferences,
  type RegTerm,
  type RuleOutcome,
  type ScheduleState,
  type SuggestResult,
  type TimeOfDay,
} from '@/lib/api';

const TYPE_SHORT = { lecture: 'L', seminar: 'S', lab: 'Lab' } as const;
const TIMES: TimeOfDay[] = ['any', 'morning', 'afternoon', 'evening'];
const WEEKDAYS = [1, 2, 3, 4, 5, 6];
const DEFAULTS: Preferences = { timeOfDay: 'any', timeStrict: false, freeDays: [], freeDaysStrict: false, avoidEarly: false, compact: true, fewerDays: false };

function Pill({ active, onPress, children }: { active: boolean; onPress: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-pressed={active}
      className={`rounded-xl px-3 py-1.5 text-sm transition-colors ${active ? 'bg-foreground text-background' : 'bg-default text-muted hover:bg-default-hover hover:text-foreground'}`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/**
 * Timetable recommendation for Хичээл сонголт 2, asked the same way as the
 * semester planner: a few questions answered with pills, results update as
 * the answers change, the chosen timetable is previewed on the week grid.
 * A plan only — seats and registration happen in the university's system.
 */
export function TimetableRecommender({
  term,
  periods,
  hueOf,
  onApplied,
}: {
  term: RegTerm;
  periods: Period[];
  hueOf: (courseId: number) => string;
  onApplied: (state: ScheduleState) => void;
}) {
  const t = useTranslations('registration.timetable');
  const ts = useTranslations('registration.schedule');
  const days = ts.raw('days') as string[];
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [result, setResult] = useState<SuggestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [chosen, setChosen] = useState(0);
  const [applying, setApplying] = useState(false);
  const [errors, setErrors] = useState<RuleOutcome[]>([]);
  const request = useRef(0);

  const set = (patch: Partial<Preferences>) => setPrefs((p) => ({ ...p, ...patch }));

  const search = (next: Preferences) => {
    const id = ++request.current;
    setLoading(true);
    return registrationApi
      .suggest(term.id, next)
      .then((r) => {
        if (id !== request.current) return;
        setResult(r);
        setChosen(0);
      })
      .catch((e: Error) => toast.danger(e.message))
      .finally(() => id === request.current && setLoading(false));
  };

  // Re-search on every change (the search takes milliseconds); ignore out-of-order answers.
  useEffect(() => {
    const timer = setTimeout(() => void search(prefs), 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs, term.id]);

  const suggestion = result?.suggestions[chosen] ?? null;
  const blocks = useMemo<GridBlock[]>(
    () =>
      (suggestion?.sections ?? []).flatMap((sec) =>
        sec.meetings.map((m, j) => ({
          key: `${sec.id}:${j}`,
          meeting: m,
          title: `${sec.courseCode} ${TYPE_SHORT[sec.type]}`,
          subtitle: [m.room, sec.instructor?.name].filter(Boolean).join(' · '),
          hue: hueOf(sec.courseId),
          variant: 'picked' as const,
        }))
      ),
    [suggestion, hueOf]
  );

  async function apply() {
    if (!suggestion) return;
    setApplying(true);
    setErrors([]);
    try {
      onApplied(await registrationApi.apply(term.id, suggestion.sectionIds));
      toast.success(t('applied'));
    } catch (err) {
      const violation = violationOf(err);
      setErrors(violation ? violation.errors : []);
      void search(prefs); // the offer may have changed meanwhile — refresh the options
    } finally {
      setApplying(false);
    }
  }

  const perDay = (sections: SuggestResult['suggestions'][number]['sections']) => {
    const count = new Map<number, number>();
    for (const s of sections) for (const m of s.meetings) count.set(m.dayOfWeek, (count.get(m.dayOfWeek) ?? 0) + 1);
    return [1, 2, 3, 4, 5, ...(count.has(6) ? [6] : [])].map((d) => ({ day: days[d - 1], n: count.get(d) ?? 0 }));
  };

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-4 rounded-2xl bg-default/50 p-4">
          <Field label={t('when')}>
            {TIMES.map((x) => (
              <Pill key={x} active={prefs.timeOfDay === x} onPress={() => set({ timeOfDay: x, timeStrict: x === 'any' ? false : prefs.timeStrict })}>
                {ts(`times.${x}`)}
                {x !== 'any' && <span className="ml-1 text-xs opacity-60">{ts(`timeHint.${x}`)}</span>}
              </Pill>
            ))}
          </Field>
          {prefs.timeOfDay !== 'any' && (
            <Field label={t('how')}>
              <Pill active={!prefs.timeStrict} onPress={() => set({ timeStrict: false })}>
                {t('wish')}
              </Pill>
              <Pill active={prefs.timeStrict} onPress={() => set({ timeStrict: true })}>
                {t('mustTime')}
              </Pill>
            </Field>
          )}
          <Field label={t('freeDays')}>
            {WEEKDAYS.map((d) => (
              <Pill
                key={d}
                active={prefs.freeDays.includes(d)}
                onPress={() => {
                  const freeDays = prefs.freeDays.includes(d) ? prefs.freeDays.filter((x) => x !== d) : [...prefs.freeDays, d].sort();
                  set({ freeDays, freeDaysStrict: freeDays.length ? prefs.freeDaysStrict : false });
                }}
              >
                {days[d - 1]}
              </Pill>
            ))}
          </Field>
          {prefs.freeDays.length > 0 && (
            <Field label={t('how')}>
              <Pill active={!prefs.freeDaysStrict} onPress={() => set({ freeDaysStrict: false })}>
                {t('wish')}
              </Pill>
              <Pill active={prefs.freeDaysStrict} onPress={() => set({ freeDaysStrict: true })}>
                {t('mustDays')}
              </Pill>
            </Field>
          )}
          <Field label={t('other')}>
            <Pill active={prefs.avoidEarly} onPress={() => set({ avoidEarly: !prefs.avoidEarly })}>
              {t('avoidEarly')}
            </Pill>
            <Pill active={prefs.compact} onPress={() => set({ compact: !prefs.compact })}>
              {t('compact')}
            </Pill>
            <Pill active={prefs.fewerDays} onPress={() => set({ fewerDays: !prefs.fewerDays })}>
              {t('fewerDays')}
            </Pill>
          </Field>
          <p className="text-xs text-muted">{ts('handbookTip')}</p>
        </div>

        {errors.length > 0 && <RuleIssues outcomes={errors} />}

        {!result ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className={`flex flex-col gap-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-medium">{t('results')}</h3>
              <span className="text-xs text-muted">{ts('explored', { n: result.explored, ms: result.tookMs })}</span>
            </div>

            {result.blockedSlots.length > 0 && (
              <div className="rounded-xl bg-warning-soft px-3 py-2.5 text-sm text-warning-soft-foreground">
                <p className="font-medium">{ts('blockedTitle')}</p>
                <ul className="mt-1 list-disc pl-5">
                  {result.blockedSlots.map((b) => (
                    <li key={`${b.courseId}:${b.type}`}>
                      {b.courseLabel} ({ts(`types.${b.type}`)}) — {ts(`blockedReason.${b.reason}`, { times: b.meetings.map((m) => `${days[m.dayOfWeek - 1]} ${formatRange(m)}`).join(', ') })}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-xs opacity-80">{result.relaxed ? ts('relaxed') : ts('relax')}</p>
              </div>
            )}
            {result.suggestions.length === 0 && result.blockedSlots.length === 0 && <p className="text-sm text-muted">{ts('none')}</p>}

            <ul className="flex flex-col gap-2">
              {result.suggestions.map((s, i) => {
                const b = s.breakdown;
                return (
                  <li key={s.sectionIds.join('-')}>
                    <button
                      type="button"
                      onClick={() => setChosen(i)}
                      className={`w-full rounded-2xl border p-3 text-left transition-colors ${i === chosen ? 'border-accent bg-accent-soft/40' : 'border-separator hover:bg-default/40'}`}
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-medium">{ts('option', { n: i + 1 })}</span>
                        {i === 0 && (
                          <Chip size="sm" variant="soft" color="accent">
                            {ts('best')}
                          </Chip>
                        )}
                        <Chip size="sm" variant="soft">{ts('campusDays', { n: b.campusDays })}</Chip>
                        <Chip size="sm" variant="soft">{ts('gaps', { n: b.gapMinutes })}</Chip>
                        {prefs.freeDays.length > 0 && (
                          <Chip size="sm" variant="soft" color={b.freeDayClasses ? 'warning' : 'success'}>
                            {b.freeDayClasses ? ts('freeDayLost', { n: b.freeDayClasses }) : ts('freeDayKept')}
                          </Chip>
                        )}
                        {prefs.timeOfDay !== 'any' && b.outsideWindow > 0 && (
                          <Chip size="sm" variant="soft" color="warning">
                            {ts('outside', { n: b.outsideWindow })}
                          </Chip>
                        )}
                        {prefs.avoidEarly && b.earlyClasses > 0 && <Chip size="sm" variant="soft">{ts('early', { n: b.earlyClasses })}</Chip>}
                      </div>
                      <div className="mt-2 flex gap-1">
                        {perDay(s.sections).map(({ day, n }) => (
                          <span key={day} className={`flex-1 rounded-md py-1 text-center text-[11px] tabular-nums ${n ? 'bg-default text-foreground' : 'bg-success-soft text-success-soft-foreground'}`}>
                            {day} {n || '—'}
                          </span>
                        ))}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <aside className="order-first flex min-w-0 flex-col gap-3 xl:sticky xl:top-4 xl:order-none">
        <Card>
          <Card.Header className="flex-row items-center justify-between gap-2">
            <Card.Title className="text-base">{suggestion ? ts('option', { n: chosen + 1 }) : t('results')}</Card.Title>
            {suggestion && <span className="text-xs text-muted">{ts('changes', { n: suggestion.changes })}</span>}
          </Card.Header>
          <Card.Content className="flex flex-col gap-3">
            <WeekGrid periods={periods} blocks={blocks} />
            <Button isDisabled={!suggestion || applying} onPress={apply}>
              {applying ? <Spinner size="sm" /> : <ArrowRight className="size-4" />}
              {t('apply')}
            </Button>
          </Card.Content>
        </Card>
      </aside>
    </div>
  );
}
