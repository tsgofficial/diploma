'use client';

/**
 * Small helpers shared by the registration pages: picking the right language
 * from `{ mn, en }` texts, and formatting class times.
 */
import { useLocale } from 'next-intl';
import { useCallback } from 'react';
import type { Localized, Meeting } from './api';

/** `l(text)` → the text in the current UI language. */
export function useLocalized() {
  const locale = useLocale();
  return useCallback((text: Localized | null | undefined) => (text ? (locale === 'en' ? text.en : text.mn) : ''), [locale]);
}

export function formatMinute(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

export function formatRange(m: Pick<Meeting, 'startMinute' | 'endMinute'>): string {
  return `${formatMinute(m.startMinute)}–${formatMinute(m.endMinute)}`;
}

/** Stable per-course hue for the weekly grid (readable in light and dark themes). */
const HUES = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316'];
export function courseHue(index: number): string {
  return HUES[index % HUES.length];
}

export function formatGpa(gpa: number | null | undefined): string {
  return gpa === null || gpa === undefined ? '—' : gpa.toFixed(2);
}
