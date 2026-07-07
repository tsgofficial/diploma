/**
 * Thin client for the Node core-backend. The frontend talks ONLY to this
 * backend — never directly to the Python rag-engine. Every protected call
 * carries the JWT as a Bearer token.
 */
import { getToken } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

export interface AuthResult {
  user: AuthUser;
  token: string;
}

export interface ChatReply {
  answer: string;
  sources: string[];
  refused: boolean;
}

/** Build headers, attaching the Bearer token when present. */
function headers(): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** Read a JSON error message, falling back to a generic one. */
async function errorMessage(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return (data && data.error) || `Request failed (${res.status})`;
}

export async function register(
  email: string,
  password: string,
  name?: string
): Promise<AuthResult> {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}

/** Create a new conversation session and return its id. */
export async function createSession(): Promise<string> {
  const res = await fetch(`${API_URL}/api/sessions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  const data: { id: string } = await res.json();
  return data.id;
}

/** Send one question in a session and get the assistant's reply. */
export async function sendMessage(sessionId: string, question: string): Promise<ChatReply> {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ sessionId, question }),
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}
