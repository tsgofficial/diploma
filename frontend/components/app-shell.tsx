'use client';

import { Button, Drawer, Spinner } from '@heroui/react';
import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Sidebar } from './sidebar';
import { ShellContext, type ShellState } from './shell-context';
import { ApiError, authApi, sessionApi, type ChatSession } from '@/lib/api';
import { clearSession, getStoredUser, getToken, storeUser, type CurrentUser } from '@/lib/auth';

/**
 * Authenticated frame: sidebar (drawer on phones) + content. Redirects to
 * /login without a token, re-validates the user (and their role) on mount,
 * and owns the conversation list so the chat view can update titles.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    authApi
      .me()
      .then((fresh) => {
        storeUser(fresh);
        setUser(fresh);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          clearSession();
          router.replace('/login');
        }
      });
  }, [router]);

  const refreshSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      setSessions(await sessionApi.list());
    } catch {
      /* sidebar stays as it was */
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void refreshSessions();
  }, [user, refreshSessions]);

  const value = useMemo<ShellState | null>(
    () =>
      user && {
        user,
        sessions,
        sessionsLoading,
        refreshSessions,
        upsertSession: (s) =>
          setSessions((prev) => {
            const rest = prev.filter((x) => x.id !== s.id);
            return [s, ...rest];
          }),
        removeSession: (id) => setSessions((prev) => prev.filter((x) => x.id !== id)),
        closeMobileNav: () => setNavOpen(false),
      },
    [user, sessions, sessionsLoading, refreshSessions]
  );

  if (!value) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <ShellContext.Provider value={value}>
      <div className="flex h-dvh overflow-hidden">
        <aside className="hidden w-64 shrink-0 border-r border-separator bg-surface-secondary/60 md:block">
          <Sidebar />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b border-separator px-2 md:hidden">
            <Button variant="ghost" size="sm" isIconOnly aria-label={t('nav.menu')} onPress={() => setNavOpen(true)}>
              <Menu className="size-5" />
            </Button>
            <span className="text-sm font-semibold">{t('app.name')}</span>
          </header>
          <main className="min-h-0 flex-1">{children}</main>
        </div>

        <Drawer isOpen={navOpen} onOpenChange={setNavOpen}>
          <Drawer.Backdrop isDismissable>
            <Drawer.Content placement="left" className="w-72 max-w-[85vw]">
              <Drawer.Dialog className="h-full p-0">
                <Sidebar />
              </Drawer.Dialog>
            </Drawer.Content>
          </Drawer.Backdrop>
        </Drawer>
      </div>
    </ShellContext.Provider>
  );
}
