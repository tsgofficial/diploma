'use client';

import { Card, Chip, Disclosure, Spinner } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { PlanRecommender } from '@/components/registration/plan-recommender';
import { RegistrationFrame } from '@/components/registration/registration-frame';
import { useLocalized } from '@/lib/registration';
import { registrationApi, type CurriculumState } from '@/lib/api';

/** The program's curriculum blocks (хүснэгт 8.1) and the courses in each. */
function CurriculumBlocks() {
  const t = useTranslations('registration');
  const l = useLocalized();
  const [data, setData] = useState<CurriculumState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    registrationApi.curriculum().then(setData).catch((e: Error) => setError(e.message));
  }, []);

  return (
    <Card>
      <Card.Header>
        <Card.Title className="text-base">{t('curriculum.title')}</Card.Title>
        {data && <Card.Description>{t('curriculum.subtitle', { program: l(data.program.name), credits: data.program.totalCredits })}</Card.Description>}
      </Card.Header>
      <Card.Content>
        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : !data ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-separator">
            {data.blocks.map((block) => (
              <li key={block.code} className="py-1">
                <Disclosure>
                  <Disclosure.Heading>
                    <Disclosure.Trigger className="flex w-full items-center justify-between gap-3 py-2 text-left">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium">{l(block.name)}</span>
                        <Chip size="sm" variant="soft">
                          {block.isElective ? t('curriculum.elective') : t('curriculum.required')}
                        </Chip>
                      </span>
                      <span className="flex shrink-0 items-center gap-3 text-xs text-muted">
                        <span className="tabular-nums">{t('curriculum.credits', { n: block.minCredits })}</span>
                        <span className="tabular-nums">{t('curriculum.courses', { n: block.courses.length })}</span>
                        <Disclosure.Indicator className="size-4" />
                      </span>
                    </Disclosure.Trigger>
                  </Disclosure.Heading>
                  <Disclosure.Content>
                    <Disclosure.Body>
                      {block.isElective && <p className="mb-2 text-xs text-muted">{t('curriculum.electiveHint', { n: block.minCredits })}</p>}
                      <table className="mb-2 w-full text-sm">
                        <tbody>
                          {block.courses.map((c) => (
                            <tr key={c.id} className="border-t border-separator/60">
                              <td className="w-20 py-1.5 font-mono text-xs font-semibold">{c.code}</td>
                              <td className="py-1.5">{l(c.name)}</td>
                              <td className="w-24 py-1.5 text-right text-xs text-muted">{c.recommendedSemester ? t('plan.semester', { n: c.recommendedSemester }) : ''}</td>
                              <td className="w-14 py-1.5 text-right tabular-nums text-muted">{t('plan.credits', { n: c.credits })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Disclosure.Body>
                  </Disclosure.Content>
                </Disclosure>
              </li>
            ))}
          </ul>
        )}
      </Card.Content>
    </Card>
  );
}

export default function PlanPage() {
  const t = useTranslations('registration');
  return (
    <RegistrationFrame title={t('plan.pageTitle')} subtitle={t('plan.pageSubtitle')}>
      {() => (
        <div className="mt-6 flex flex-col gap-6">
          <Card>
            <Card.Header>
              <Card.Title className="text-base">{t('plan.title')}</Card.Title>
              <Card.Description>{t('plan.subtitle')}</Card.Description>
            </Card.Header>
            <Card.Content>
              <PlanRecommender />
            </Card.Content>
          </Card>
          <CurriculumBlocks />
        </div>
      )}
    </RegistrationFrame>
  );
}
