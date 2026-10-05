'use client';

import { Alert, Spinner, toast } from '@heroui/react';
import { CheckCircle2, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PlanYears } from './plan-years';
import { useLocalized } from '@/lib/registration';
import { registrationApi, type PlanIssue, type PlanOptions, type PlanPreferences, type PlanState } from '@/lib/api';

const LOADS = [12, 15, 18, 21];

function Pill({ active, onPress, children, className = '' }: { active: boolean; onPress: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-pressed={active}
      className={`rounded-xl px-3 py-1.5 text-sm transition-colors ${
        active ? 'bg-foreground text-background' : 'bg-default text-muted hover:bg-default-hover hover:text-foreground'
      } ${className}`}
    >
      {children}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/**
 * Semester planner with the student's wishes: when to graduate (each choice
 * says whether it is reachable), summers, load, light semesters, interests.
 * Re-plans as the wishes change. Registering for the courses happens in the
 * university's own system.
 */
export function PlanRecommender() {
  const t = useTranslations('registration.plan');
  const l = useLocalized();
  const [options, setOptions] = useState<PlanOptions | null>(null);
  const [prefs, setPrefs] = useState<PlanPreferences | null>(null);
  const [plan, setPlan] = useState<PlanState | null>(null);
  const [loading, setLoading] = useState(false);
  const request = useRef(0);

  useEffect(() => {
    registrationApi
      .planOptions()
      .then((o) => {
        setOptions(o);
        setPrefs(o.defaults);
      })
      .catch((e: Error) => toast.danger(e.message));
  }, []);

  // Re-plan on every change (planning takes milliseconds); ignore out-of-order answers.
  useEffect(() => {
    if (!prefs) return;
    const id = ++request.current;
    setLoading(true);
    const timer = setTimeout(() => {
      registrationApi
        .plan(prefs)
        .then((p) => id === request.current && setPlan(p))
        .catch((e: Error) => toast.danger(e.message))
        .finally(() => id === request.current && setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [prefs]);

  if (!options || !prefs) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  const set = (patch: Partial<PlanPreferences>) => setPrefs((p) => p && { ...p, ...patch });
  const toggle = (list: number[] | string[], value: number | string) =>
    (list as Array<number | string>).includes(value) ? (list as Array<number | string>).filter((x) => x !== value) : [...list, value];
  const target = prefs.targetSemesters ?? options.standardSemesters;
  const lightChoices = options.semesters.filter((s) => s.semester <= target);
  const courseList = (cs: Array<{ code: string }>) => cs.map((c) => c.code).join(', ');
  const mainLoads = (plan?.terms ?? []).filter((x) => x.semester && x.courses.length).map((x) => x.loadCredits);
  const summerCredits = (plan?.terms ?? [])
    .filter((x) => !x.semester)
    .flatMap((x) => x.courses)
    .filter((c) => !c.isInternship)
    .reduce((sum, c) => sum + c.credits, 0);
  const issueText = (issue: PlanIssue): ReactNode => {
    switch (issue.code) {
      case 'chain':
        return (
          <>
            {t('chain')}{' '}
            <span className="font-medium">
              {issue.chain.map((x, i) => (
                <span key={x.code}>
                  {i > 0 && ' → '}
                  {x.code} <span className="font-normal opacity-80">({l(x.term.name)})</span>
                </span>
              ))}
            </span>
          </>
        );
      case 'credits':
        return t('noRoom', { needed: issue.needed, capacity: issue.capacity });
      case 'overload':
        return t('overload', { term: l(issue.term.name), list: courseList(issue.courses) });
      case 'preferred_load':
        return t('preferredLoad', { list: issue.terms.map((x) => l(x.name)).join(', ') });
      case 'unschedulable':
        return t('unschedulable', { list: courseList(issue.courses) });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-2xl bg-default/50 p-4">
        <Field label={t('when')}>
          {options.targets.map((o) => (
            <Pill key={o.semesters} active={target === o.semesters} onPress={() => set({ targetSemesters: o.semesters, lightSemesters: prefs.lightSemesters.filter((s) => s <= o.semesters) })} className="text-left">
              <span className="block font-medium">
                {t('years', { n: o.years })} <span className="font-normal opacity-70">· {l(o.term.name)}</span>
              </span>
              <span className={`block text-xs ${target === o.semesters ? 'opacity-80' : o.feasible ? 'text-success' : o.feasibleWithSummer ? 'text-warning' : 'text-danger'}`}>
                {o.feasible ? t('possible') : o.feasibleWithSummer ? t('withSummer') : t('impossible')}
              </span>
            </Pill>
          ))}
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('maxLoad')}>
            {LOADS.filter((n) => n <= options.limits.hardMax).map((n) => (
              <Pill key={n} active={prefs.maxLoad === n} onPress={() => set({ maxLoad: n })}>
                {t('credits', { n })}
              </Pill>
            ))}
          </Field>
          <Field label={t('light')} hint={t('lightHint')}>
            {lightChoices.map((s) => (
              <Pill key={s.semester} active={prefs.lightSemesters.includes(s.semester)} onPress={() => set({ lightSemesters: toggle(prefs.lightSemesters, s.semester) as number[] })}>
                {t('semester', { n: s.semester })}
              </Pill>
            ))}
          </Field>
        </div>

        <Field label={t('interests')} hint={t('interestsHint')}>
          {options.interests.map((i) => (
            <Pill key={i.key} active={prefs.interests.includes(i.key)} onPress={() => set({ interests: toggle(prefs.interests, i.key) as string[] })}>
              <span title={i.courses.join(', ')}>{l(i.name)}</span>
            </Pill>
          ))}
        </Field>

        <Field label={t('summerQ')} hint={t('summerHint', { n: options.limits.summerMax })}>
          <Pill active={!prefs.allowSummer} onPress={() => set({ allowSummer: false })}>
            {t('summerOff')}
          </Pill>
          <Pill active={prefs.allowSummer} onPress={() => set({ allowSummer: true })}>
            {t('summerOn')}
          </Pill>
        </Field>
      </div>

      {!plan ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <div className={`flex flex-col gap-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {plan.feasible && plan.graduationTerm ? (
            <Alert status="success">
              <Alert.Indicator>
                <CheckCircle2 className="size-5" />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>{t('feasible', { term: l(plan.graduationTerm.name) })}</Alert.Title>
              </Alert.Content>
            </Alert>
          ) : (
            <Alert status="warning">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>
                  {t('infeasible', { target: plan.targetTerm ? l(plan.targetTerm.name) : '' })}
                  {plan.earliestTerm && <span className="font-normal"> · {t('earliest', { term: l(plan.earliestTerm.name) })}</span>}
                </Alert.Title>
              </Alert.Content>
            </Alert>
          )}
          {plan.issues.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm text-muted">
              {plan.issues.map((issue, i) => (
                <li key={i}>• {issueText(issue)}</li>
              ))}
            </ul>
          )}

          <p className="text-sm text-muted">
            {t('stats', {
              avg: Math.round(mainLoads.reduce((a, b) => a + b, 0) / Math.max(1, mainLoads.length)),
              max: Math.max(0, ...mainLoads),
            })}
            {plan.preferences.allowSummer && ` · ${t('summerUsed', { n: summerCredits })}`}
          </p>

          <PlanYears plan={plan} interests={options.interests} />
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Lock className="size-3" /> {t('forced')} · {t('note', { ms: plan.tookMs })}
          </p>
        </div>
      )}
    </div>
  );
}
