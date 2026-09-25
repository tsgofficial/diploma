'use client';

import { Button, Tooltip } from '@heroui/react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const t = useTranslations('common');
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === 'dark';
  return (
    <Tooltip>
      <Tooltip.Trigger>
        <Button variant="ghost" size="sm" isIconOnly aria-label={t('theme')} onPress={() => setTheme(isDark ? 'light' : 'dark')}>
          {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Content>{isDark ? t('light') : t('dark')}</Tooltip.Content>
    </Tooltip>
  );
}
