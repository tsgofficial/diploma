'use client';

import { LOCALE_COOKIE, type Locale } from '@/i18n/config';

/** Persist the language choice and re-render server components with it. */
export function setLocaleCookie(locale: Locale): void {
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${oneYear}; samesite=lax`;
}
