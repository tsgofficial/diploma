'use client';

import { Chip } from '@heroui/react';
import { FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { Citation } from '@/lib/api';
import { SourceViewer } from './source-viewer';

function pageLabel(pages: number[], abbr: string): string {
  if (pages.length === 0) return '';
  const sorted = [...pages].sort((a, b) => a - b);
  // Collapse consecutive runs: [19,20,21,24] → "19–21, 24"
  const runs: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (const p of sorted.slice(1)) {
    if (p === prev + 1) {
      prev = p;
      continue;
    }
    runs.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = prev = p;
  }
  runs.push(start === prev ? `${start}` : `${start}–${prev}`);
  return `${abbr} ${runs.join(', ')}`;
}

/** Source chips under an answer; pressing one opens the cited pages of the original PDF. */
export function Sources({ citations, sources }: { citations: Citation[]; sources: string[] }) {
  const t = useTranslations();
  const [viewing, setViewing] = useState<Citation | null>(null);
  const items: Citation[] = citations.length > 0 ? citations : sources.map((s) => ({ docTitle: s, pages: [] }));
  if (items.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs text-muted">{t('chat.sources')}:</span>
      {items.map((c) => (
        <button
          key={c.docTitle}
          type="button"
          onClick={() => setViewing(c)}
          title={t('viewer.view')}
          className="max-w-full cursor-pointer rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Chip size="sm" variant="soft" color="default" className="max-w-full">
            <FileText className="size-3 shrink-0" />
            <Chip.Label className="truncate">
              {c.docTitle}
              {c.pages.length > 0 && <span className="text-muted"> · {pageLabel(c.pages, t('common.pages'))}</span>}
            </Chip.Label>
          </Chip>
        </button>
      ))}
      <SourceViewer citation={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
