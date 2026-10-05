'use client';

import { useTranslations } from 'next-intl';
import { formatMinute } from '@/lib/registration';
import type { Meeting, Period } from '@/lib/api';

export interface GridBlock {
  key: string;
  meeting: Meeting;
  title: string;
  subtitle?: string;
  hue: string;
  variant: 'picked' | 'preview' | 'clash';
}

/**
 * Weekly timetable: one column per weekday, blocks placed by their real
 * minutes. Odd-week and even-week classes share a slot side by side.
 */
export function WeekGrid({ periods, blocks, compact = false }: { periods: Period[]; blocks: GridBlock[]; compact?: boolean }) {
  const t = useTranslations('registration.schedule');
  const dayNames = t.raw('days') as string[];
  const hasSaturday = blocks.some((b) => b.meeting.dayOfWeek === 6);
  const days = hasSaturday ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
  const start = periods[0]?.start ?? 7 * 60 + 40;
  const end = periods[periods.length - 1]?.end ?? 19 * 60 + 10;
  const px = compact ? 0.3 : 0.8;
  const height = (end - start) * px;

  return (
    <div className={compact ? '' : 'overflow-x-auto'}>
      <div className={`grid ${compact ? '' : 'min-w-[520px]'}`} style={{ gridTemplateColumns: `${compact ? 0 : 44}px repeat(${days.length}, minmax(0, 1fr))` }}>
        <div />
        {days.map((d) => (
          <div key={d} className={`pb-1 text-center font-medium text-muted ${compact ? 'text-[10px]' : 'text-xs'}`}>
            {dayNames[d - 1]}
          </div>
        ))}

        <div className="relative" style={{ height }}>
          {!compact &&
            periods.map((p) => (
              <div key={p.no} className="absolute right-1.5 text-right text-[10px] leading-tight text-muted" style={{ top: (p.start - start) * px }}>
                <div className="font-medium">{p.no}</div>
                <div className="tabular-nums">{formatMinute(p.start)}</div>
              </div>
            ))}
        </div>

        {days.map((d) => (
          <div key={d} className="relative border-l border-separator" style={{ height }}>
            {periods.map((p) => (
              <div key={p.no} className="absolute inset-x-0 border-t border-dashed border-separator/70" style={{ top: (p.start - start) * px, height: (p.end - p.start) * px }} />
            ))}
            {blocks
              .filter((b) => b.meeting.dayOfWeek === d)
              .map((b) => {
                const m = b.meeting;
                const left = m.weekParity === 'even' ? '50%' : '0%';
                const right = m.weekParity === 'odd' ? '50%' : '0%';
                const hue = b.variant === 'clash' ? 'var(--color-danger)' : b.hue;
                return (
                  <div
                    key={b.key}
                    title={[b.title, b.subtitle].filter(Boolean).join(' · ')}
                    className={`absolute overflow-hidden rounded-md px-1 py-0.5 leading-tight ${compact ? 'text-[9px]' : 'text-[11px]'} ${
                      b.variant === 'picked' ? '' : 'border border-dashed'
                    }`}
                    style={{
                      top: (m.startMinute - start) * px + 1,
                      height: Math.max((m.endMinute - m.startMinute) * px - 2, 8),
                      left: `calc(${left} + 2px)`,
                      right: `calc(${right} + 2px)`,
                      background: `color-mix(in oklab, ${hue} ${b.variant === 'picked' ? 20 : 10}%, transparent)`,
                      borderLeft: `3px solid ${hue}`,
                      borderColor: b.variant === 'picked' ? undefined : hue,
                    }}
                  >
                    <div className="truncate font-semibold">{b.title}</div>
                    {!compact && b.subtitle && <div className="truncate text-muted">{b.subtitle}</div>}
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}
