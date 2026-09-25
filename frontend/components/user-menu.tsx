'use client';

import { Avatar, Dropdown, Header } from '@heroui/react';
import { ChevronsUpDown, Languages, LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { useShell } from './shell-context';
import { clearSession, initials } from '@/lib/auth';
import { setLocaleCookie } from '@/lib/locale';
import type { Locale } from '@/i18n/config';

export function UserMenu() {
  const t = useTranslations();
  const { user } = useShell();
  const { theme, setTheme } = useTheme();
  const locale = useLocale() as Locale;
  const router = useRouter();

  function onAction(key: React.Key) {
    const k = String(key);
    if (k.startsWith('theme:')) setTheme(k.slice(6));
    else if (k.startsWith('lang:')) {
      setLocaleCookie(k.slice(5) as Locale);
      router.refresh();
    } else if (k === 'signout') {
      clearSession();
      router.replace('/login');
    }
  }

  return (
    <Dropdown>
      <Dropdown.Trigger className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-default/60 data-[pressed]:bg-default">
        <Avatar size="sm">
          <Avatar.Fallback>{initials(user)}</Avatar.Fallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{user.name || user.email}</span>
          <span className="block truncate text-xs text-muted">{user.role === 'admin' ? t('admin.roles.admin') : user.email}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="top start" className="min-w-56">
        <Dropdown.Menu onAction={onAction} selectionMode="none">
          <Dropdown.Section>
            <Header>{t('common.theme')}</Header>
            <Dropdown.Item id="theme:light" textValue={t('common.light')}>
              <Sun className="size-4" /> {t('common.light')} {theme === 'light' && '✓'}
            </Dropdown.Item>
            <Dropdown.Item id="theme:dark" textValue={t('common.dark')}>
              <Moon className="size-4" /> {t('common.dark')} {theme === 'dark' && '✓'}
            </Dropdown.Item>
            <Dropdown.Item id="theme:system" textValue={t('common.system')}>
              <Monitor className="size-4" /> {t('common.system')} {theme === 'system' && '✓'}
            </Dropdown.Item>
          </Dropdown.Section>
          <Dropdown.Section>
            <Header>{t('common.language')}</Header>
            <Dropdown.Item id="lang:mn" textValue="Монгол">
              <Languages className="size-4" /> Монгол {locale === 'mn' && '✓'}
            </Dropdown.Item>
            <Dropdown.Item id="lang:en" textValue="English">
              <Languages className="size-4" /> English {locale === 'en' && '✓'}
            </Dropdown.Item>
          </Dropdown.Section>
          <Dropdown.Section>
            <Dropdown.Item id="signout" textValue={t('common.signOut')} className="text-danger">
              <LogOut className="size-4" /> {t('common.signOut')}
            </Dropdown.Item>
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
