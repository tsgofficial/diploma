'use client';

import { Button } from '@heroui/react';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatRange } from '@/lib/registration';
import type { SectionOption } from '@/lib/api';

/** One teacher/time option of a course component in Хичээл сонголт 2. */
export function SectionOptionRow({
  option,
  busy,
  onPick,
  onDrop,
  onHover,
}: {
  option: SectionOption;
  busy: boolean;
  onPick: (o: SectionOption) => void;
  onDrop: (o: SectionOption) => void;
  onHover: (o: SectionOption | null) => void;
}) {
  const t = useTranslations('registration.schedule');
  const days = t.raw('days') as string[];
  const clash = !option.picked && option.conflictsWith.length > 0;

  return (
    <li
      onMouseEnter={() => onHover(option)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(option)}
      onBlur={() => onHover(null)}
      className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${
        option.picked ? 'border-accent/60 bg-accent-soft/40' : 'border-separator hover:bg-default/40'
      }`}
    >
      <div className="min-w-0 flex-1 text-sm">
        <div className="flex flex-wrap items-baseline gap-x-2">
          {option.meetings.map((m, i) => (
            <span key={i} className="font-medium tabular-nums">
              {days[m.dayOfWeek - 1]} {formatRange(m)}
              {m.weekParity !== 'all' && <span className="ml-1 text-xs font-normal text-muted">({t(m.weekParity)})</span>}
            </span>
          ))}
          <span className="text-xs text-muted">{option.code}</span>
        </div>
        <div className="mt-0.5 truncate text-xs text-muted">
          {option.instructor ? `${option.instructor.name}${option.instructor.title ? `, ${option.instructor.title}` : ''}` : '—'}
          {option.meetings[0]?.room && ` · ${option.meetings[0].room}`}
        </div>
        {clash && (
          <p className="mt-1 flex items-center gap-1 text-xs text-warning">
            <AlertTriangle className="size-3.5 shrink-0" />
            {t('conflict', { list: option.conflictsWith.join(', ') })}
          </p>
        )}
      </div>

      <div className="w-24 shrink-0 text-right">
        {option.picked ? (
          <Button size="sm" variant="ghost" isDisabled={busy} onPress={() => onDrop(option)}>
            {t('drop')}
          </Button>
        ) : (
          <Button size="sm" variant={clash ? 'ghost' : 'secondary'} isDisabled={busy} onPress={() => onPick(option)}>
            {t('pick')}
          </Button>
        )}
      </div>
    </li>
  );
}
