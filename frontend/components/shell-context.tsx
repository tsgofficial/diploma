'use client';

import { createContext, useContext } from 'react';
import type { ChatSession } from '@/lib/api';
import type { CurrentUser } from '@/lib/auth';

export interface ShellState {
  user: CurrentUser;
  sessions: ChatSession[];
  sessionsLoading: boolean;
  refreshSessions: () => Promise<void>;
  /** Optimistically insert/update one session in the sidebar. */
  upsertSession: (session: ChatSession) => void;
  removeSession: (id: string) => void;
  closeMobileNav: () => void;
}

export const ShellContext = createContext<ShellState | null>(null);

export function useShell(): ShellState {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used inside <AppShell>');
  return ctx;
}
