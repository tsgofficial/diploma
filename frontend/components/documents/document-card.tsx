'use client';

import { Card, Chip } from '@heroui/react';
import { FileText } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { KbDocument } from '@/lib/api';

const KNOWN_CATEGORIES = new Set(['handbook', 'regulation', 'journal']);

export function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Browsers rarely ship Mongolian month names; numeric is what local documents use.
  if (locale === 'mn') return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function CategoryChip({ category }: { category: string | null }) {
  const t = useTranslations('documents.categories');
  if (!category) return null;
  const label = KNOWN_CATEGORIES.has(category) ? t(category as 'handbook' | 'regulation' | 'journal') : category;
  return (
    <Chip size="sm" variant="soft" color="accent">
      {label}
    </Chip>
  );
}

export function DocumentCard({ doc }: { doc: KbDocument }) {
  const t = useTranslations('documents');
  const locale = useLocale();
  return (
    <Card className="h-full">
      <Card.Header className="flex-row items-start gap-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-default text-muted">
          <FileText className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <Card.Title className="text-base leading-snug">{doc.title}</Card.Title>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <CategoryChip category={doc.category} />
            <span>{t('pages', { count: doc.pageCount })}</span>
          </div>
        </div>
      </Card.Header>
      <Card.Footer className="justify-between text-xs text-muted">
        <span>{t('effective')}: {formatDate(doc.effectiveDate, locale)}</span>
        <span>{t('uploaded')}: {formatDate(doc.uploadedAt, locale)}</span>
      </Card.Footer>
    </Card>
  );
}
