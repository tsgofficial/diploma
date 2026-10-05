'use client';

import { Spinner } from '@heroui/react';
import { CalendarClock, UserX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { ApiError, registrationApi, type Period, type RegTerm } from '@/lib/api';

export interface TermContext {
  term: RegTerm;
  periods: Period[];
}

function Empty({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-default text-muted">{icon}</div>
      <p className="font-medium">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted">{hint}</p>}
    </div>
  );
}

/**
 * Page chrome shared by the registration pages: loads the open term and
 * handles "no term" / "not a student".
 */
export function RegistrationFrame({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: (ctx: TermContext) => ReactNode;
}) {
  const t = useTranslations('registration');
  const [ctx, setCtx] = useState<TermContext | null>(null);
  const [problem, setProblem] = useState<'no_term' | 'no_student' | 'error' | null>(null);

  useEffect(() => {
    registrationApi
      .current()
      .then((r) => (r.hasStudent ? setCtx({ term: r.term, periods: r.periods }) : setProblem('no_student')))
      .catch((err) => setProblem(err instanceof ApiError && err.code === 'no_term' ? 'no_term' : 'error'));
  }, []);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>
          </div>
          {actions}
        </div>

        {problem === 'no_term' ? (
          <Empty icon={<CalendarClock className="size-5" />} title={t('noTerm')} />
        ) : problem === 'no_student' ? (
          <Empty icon={<UserX className="size-5" />} title={t('noStudent')} hint={t('noStudentHint')} />
        ) : problem === 'error' ? (
          <p className="mt-8 text-sm text-danger">{t('noTerm')}</p>
        ) : !ctx ? (
          <div className="flex justify-center py-24">
            <Spinner />
          </div>
        ) : (
          children(ctx)
        )}
      </div>
    </div>
  );
}
