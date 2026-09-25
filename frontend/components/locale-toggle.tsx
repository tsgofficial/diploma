'use client';

import { Button } from '@heroui/react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setLocaleCookie } from '@/lib/locale';
import type { Locale } from '@/i18n/config';

/** MN / EN switch. Writes the cookie, then refreshes server components. */
export function LocaleToggle() {
  const t = useTranslations('common');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, start] = useTransition();
  const next: Locale = locale === 'mn' ? 'en' : 'mn';

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={t('language')}
      isDisabled={pending}
      onPress={() => {
        setLocaleCookie(next);
        start(() => router.refresh());
      }}
      className="font-medium tabular-nums"
    >
      {next.toUpperCase()}
    </Button>
  );
}
