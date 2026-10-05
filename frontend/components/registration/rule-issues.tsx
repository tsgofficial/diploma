'use client';

import { AlertTriangle, BookOpen, CheckCircle2, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { SourceViewer } from '../chat/source-viewer';
import { useLocalized } from '@/lib/registration';
import type { Citation, RuleOutcome, RuleSource } from '@/lib/api';

/** "Тушаал №199 · 9.6-р заалт" — opens the cited page of the regulation. */
export function SourceChip({ source, onOpen }: { source: RuleSource; onOpen: (c: Citation) => void }) {
  const t = useTranslations('registration.rules');
  return (
    <button
      type="button"
      title={t('openSource')}
      onClick={() => onOpen({ docTitle: source.docTitle, pages: source.page ? [source.page] : [] })}
      className="inline-flex max-w-full items-center gap-1 rounded-full bg-default px-2 py-0.5 text-[11px] text-muted transition-colors hover:bg-default-hover hover:text-foreground"
    >
      <BookOpen className="size-3 shrink-0" />
      {source.clause && <span className="shrink-0 font-medium text-foreground/80">{t('clause', { clause: source.clause })}</span>}
      <span className="truncate">
        {source.clause && '· '}
        {source.docTitle}
      </span>
    </button>
  );
}

/** The course/section code at the start of a subject label ("CS204 Алгоритм…" → "CS204"). */
function subjectCode(o: RuleOutcome): string {
  return (o.subject.label ?? '').split(' ').slice(0, o.subject.kind === 'section' ? 2 : 1).join(' ');
}

/**
 * Rule outcomes as a readable list: what is wrong, why (the message), and
 * where the rule comes from. The same rule failing for several courses is
 * shown once, with each course's message.
 */
export function RuleIssues({ outcomes, checked, showOk = false }: { outcomes: RuleOutcome[]; checked?: number; showOk?: boolean }) {
  const t = useTranslations('registration.rules');
  const l = useLocalized();
  const [viewing, setViewing] = useState<Citation | null>(null);

  const groups: RuleOutcome[][] = [];
  for (const o of outcomes) {
    const group = groups.find((g) => g[0].rule === o.rule && g[0].severity === o.severity);
    if (group) group.push(o);
    else groups.push([o]);
  }

  if (outcomes.length === 0) {
    return showOk ? (
      <p className="flex items-center gap-2 text-sm text-success">
        <CheckCircle2 className="size-4" />
        {t('allOk', { n: checked ?? 0 })}
      </p>
    ) : null;
  }

  return (
    <ul className="flex flex-col gap-2">
      {groups.map((group) => {
        const o = group[0];
        return (
          <li
            key={`${o.rule}:${o.severity}`}
            className={`flex gap-2.5 rounded-xl px-3 py-2 text-sm ${o.severity === 'error' ? 'bg-danger-soft text-danger-soft-foreground' : 'bg-warning-soft text-warning-soft-foreground'}`}
          >
            {o.severity === 'error' ? <XCircle className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="font-medium">{l(o.title)}</p>
              {group.length === 1 ? (
                o.message && <p className="mt-0.5 leading-snug opacity-90">{l(o.message)}</p>
              ) : (
                <ul className="mt-0.5 list-disc pl-4 leading-snug opacity-90">
                  {group.map((x, i) => x.message && <li key={`${subjectCode(x)}:${i}`}>{l(x.message)}</li>)}
                </ul>
              )}
              {o.source && (
                <div className="mt-1.5">
                  <SourceChip source={o.source} onOpen={setViewing} />
                </div>
              )}
            </div>
          </li>
        );
      })}
      <SourceViewer citation={viewing} onClose={() => setViewing(null)} />
    </ul>
  );
}
