'use client';

import { Card, Chip, Spinner, Tabs, toast } from '@heroui/react';
import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { OutcomeDialog, type OutcomeDialogState } from '@/components/registration/outcome-dialog';
import { RegistrationFrame, type TermContext } from '@/components/registration/registration-frame';
import { RuleIssues } from '@/components/registration/rule-issues';
import { RulesDialog } from '@/components/registration/rules-dialog';
import { SectionOptionRow } from '@/components/registration/section-option';
import { TimetableRecommender } from '@/components/registration/timetable-recommender';
import { WeekGrid, type GridBlock } from '@/components/registration/week-grid';
import { courseHue, useLocalized } from '@/lib/registration';
import { ApiError, registrationApi, violationOf, type ScheduleState, type SectionOption } from '@/lib/api';

const TYPE_SHORT = { lecture: 'L', seminar: 'S', lab: 'Lab' } as const;

function ClassSchedule({ term, periods }: TermContext) {
  const t = useTranslations('registration');
  const l = useLocalized();
  const [data, setData] = useState<ScheduleState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<SectionOption | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [dialog, setDialog] = useState<OutcomeDialogState | null>(null);

  const load = useCallback(() => registrationApi.schedule(term.id).then(setData).catch((e: Error) => setError(e.message)), [term.id]);
  useEffect(() => {
    void load();
  }, [load]);

  const hueOf = useCallback((courseId: number) => courseHue(Math.max(0, data?.courses.findIndex((c) => c.id === courseId) ?? 0)), [data]);

  const blocks = useMemo<GridBlock[]>(() => {
    if (!data) return [];
    const picked: GridBlock[] = data.picks.flatMap((p) =>
      p.meetings.map((m, i) => ({
        key: `${p.id}:${i}`,
        meeting: m,
        title: `${p.courseCode} ${TYPE_SHORT[p.type]}`,
        subtitle: [m.room, p.instructor?.name].filter(Boolean).join(' · '),
        hue: hueOf(p.courseId),
        variant: 'picked' as const,
      }))
    );
    const preview: GridBlock[] =
      hover && !hover.picked
        ? hover.meetings.map((m, i) => ({
            key: `preview:${hover.id}:${i}`,
            meeting: m,
            title: `${hover.courseCode} ${TYPE_SHORT[hover.type]}`,
            subtitle: hover.instructor?.name,
            hue: hueOf(hover.courseId),
            variant: hover.conflictsWith.length ? ('clash' as const) : ('preview' as const),
          }))
        : [];
    return [...picked, ...preview];
  }, [data, hover, hueOf]);

  async function pick(option: SectionOption) {
    setBusy(option.id);
    const label = `${option.courseCode} ${option.code}`;
    try {
      setData(await registrationApi.pick(term.id, option.id));
      setHover(null);
      toast.success(t('schedule.pickedToast', { label }));
    } catch (err) {
      const violation = violationOf(err);
      if (violation) {
        setDialog({ kind: 'blocked', title: t('schedule.pickBlockedTitle', { code: label }), body: t('schedule.pickBlockedBody'), outcomes: violation.errors });
        void load();
      } else toast.danger(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function drop(option: SectionOption) {
    setBusy(option.id);
    try {
      setData(await registrationApi.unpick(term.id, option.id));
      toast.success(t('schedule.droppedToast', { label: `${option.courseCode} ${option.code}` }));
    } catch (err) {
      toast.danger(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  if (error) return <p className="mt-8 text-sm text-danger">{error}</p>;
  if (!data) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  const outcomes = [...data.evaluation.errors, ...data.evaluation.warnings];

  return (
    <>
      {data.courses.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted">{t('schedule.noCourses')}</p>
      ) : (
        <Tabs className="mt-6" defaultSelectedKey="recommend">
          <Tabs.ListContainer>
            <Tabs.List aria-label={t('schedule.title')}>
              <Tabs.Tab id="recommend">
                <Sparkles className="size-4" />
                {t('timetable.tab')}
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="manual">
                {t('timetable.manualTab')}
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          <Tabs.Panel id="recommend" className="pt-6">
            <TimetableRecommender term={term} periods={periods} hueOf={hueOf} onApplied={setData} />
          </Tabs.Panel>
          <Tabs.Panel id="manual" className="pt-6">
            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <section className="flex min-w-0 flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Chip size="sm" variant="soft" color={data.summary.completeCourses === data.summary.courseCount ? 'success' : 'default'}>
                    {t('schedule.complete', { done: data.summary.completeCourses, total: data.summary.courseCount })}
                  </Chip>
                </div>

                {data.courses.map((course, index) => (
                  <Card key={course.id}>
                    <Card.Header className="flex-row items-center gap-2.5">
                      <span className="size-3 shrink-0 rounded-full" style={{ background: courseHue(index) }} />
                      <div className="min-w-0 flex-1">
                        <Card.Title className="truncate text-base">
                          <span className="font-mono">{course.code}</span> {l(course.name)}
                        </Card.Title>
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted">{t('schedule.credits', { n: course.credits })}</span>
                    </Card.Header>
                    <Card.Content className="flex flex-col gap-3">
                      {course.components.length === 0 && <p className="text-sm text-muted">{t('schedule.noSections')}</p>}
                      {course.components.map((comp) => (
                        <div key={comp.type}>
                          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">{t(`schedule.types.${comp.type}`)}</p>
                          <ul className="flex flex-col gap-1.5">
                            {comp.options.map((o) => (
                              <SectionOptionRow key={o.id} option={o} busy={busy === o.id} onPick={pick} onDrop={drop} onHover={setHover} />
                            ))}
                          </ul>
                        </div>
                      ))}
                    </Card.Content>
                  </Card>
                ))}
              </section>

              <aside className="order-first flex min-w-0 flex-col gap-4 xl:sticky xl:top-4 xl:order-none">
                <Card>
                  <Card.Header>
                    <Card.Title className="text-base">{t('schedule.week')}</Card.Title>
                  </Card.Header>
                  <Card.Content>
                    <WeekGrid periods={periods} blocks={blocks} />
                  </Card.Content>
                </Card>
                {data.picks.length > 0 && <RuleIssues outcomes={outcomes} checked={data.evaluation.checked} showOk />}
              </aside>
            </div>
          </Tabs.Panel>
        </Tabs>
      )}

      <OutcomeDialog state={dialog} onClose={() => setDialog(null)} />
    </>
  );
}

export default function SchedulePage() {
  const t = useTranslations('registration');
  return (
    <RegistrationFrame title={t('schedule.title')} subtitle={t('schedule.subtitle')} actions={<RulesDialog phase="schedule" />}>
      {(ctx) => <ClassSchedule {...ctx} />}
    </RegistrationFrame>
  );
}
