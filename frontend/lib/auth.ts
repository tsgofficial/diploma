'use client';

/**
 * Client-side session: the JWT and the signed-in user live in localStorage.
 * Every API call attaches the token; the app shell re-validates the user with
 * /api/auth/me on load so a stale role or a deleted account is caught.
 */
export type UserRole = 'user' | 'admin';

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

const TOKEN_KEY = 'rag.token';
const USER_KEY = 'rag.user';

function safeGet(key: string): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null): void {
  try {
    if (typeof window === 'undefined') return;
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* private mode / blocked storage — the app still works for this tab */
  }
}

export function getToken(): string | null {
  return safeGet(TOKEN_KEY);
}

export function getStoredUser(): CurrentUser | null {
  const raw = safeGet(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CurrentUser;
  } catch {
    return null;
  }
}

export function storeSession(token: string, user: CurrentUser): void {
  safeSet(TOKEN_KEY, token);
  safeSet(USER_KEY, JSON.stringify(user));
}

export function storeUser(user: CurrentUser): void {
  safeSet(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  safeSet(TOKEN_KEY, null);
  safeSet(USER_KEY, null);
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

export function initials(user: Pick<CurrentUser, 'name' | 'email'>): string {
  const source = (user.name || user.email).trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}
