'use client';

import { Alert, Spinner } from '@heroui/react';
import { useTranslations } from 'next-intl';
import type { IngestJob } from '@/lib/api';

export function JobStatus({ job }: { job: IngestJob | null }) {
  const t = useTranslations('admin');
  if (!job) return null;
  const status = job.status === 'done' ? 'success' : job.status === 'failed' ? 'danger' : 'accent';
  const title =
    job.status === 'done' ? t('jobDone') : job.status === 'failed' ? t('jobFailed') : job.status === 'running' ? t('jobRunning') : t('jobQueued');
  const last = job.error ?? job.progress[job.progress.length - 1];
  return (
    <Alert status={status} className="mb-4">
      <Alert.Indicator>{status === 'accent' ? <Spinner size="sm" /> : undefined}</Alert.Indicator>
      <Alert.Content>
        <Alert.Title>{title}</Alert.Title>
        {last && <Alert.Description className="font-mono text-xs">{last}</Alert.Description>}
      </Alert.Content>
    </Alert>
  );
}
