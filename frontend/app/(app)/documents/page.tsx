'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { DocumentCard } from '@/components/documents/document-card';
import { documentApi, type KbDocument } from '@/lib/api';

export default function DocumentsPage() {
  const t = useTranslations('documents');
  const [docs, setDocs] = useState<KbDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    documentApi.list().then(setDocs).catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>

        {error ? (
          <p className="mt-8 text-sm text-danger">{error}</p>
        ) : docs === null ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-default/60" />)}
          </div>
        ) : docs.length === 0 ? (
          <p className="mt-8 text-sm text-muted">{t('empty')}</p>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {docs.map((d) => <DocumentCard key={d.id} doc={d} />)}
          </div>
        )}
      </div>
    </div>
  );
}
