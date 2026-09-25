/**
 * Typed client for the Node core-backend. The browser talks ONLY to that
 * backend — never to the Python engine. Every protected call carries the JWT
 * as a Bearer token; chat replies arrive as a stream of server-sent events.
 */
import { getToken, type CurrentUser } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// ------------------------------------------------------------- types ----

export interface AuthResult {
  user: CurrentUser;
  token: string;
}

export interface Citation {
  docTitle: string;
  /** Engine document id; missing on messages saved before citations carried it. */
  documentId?: number | null;
  pages: number[];
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  sources: string[];
  citations: Citation[];
  refused?: boolean;
  createdAt?: string;
}

export interface ChatSession {
  id: string;
  title: string | null;
  updatedAt: string;
  createdAt: string;
}

export type ChatStreamEvent =
  | { type: 'status'; stage: 'searching' | 'generating' }
  | { type: 'sources'; sources: string[]; citations: Citation[]; refused: boolean; topScore: number }
  | { type: 'delta'; text: string }
  | { type: 'done'; answer: string; refused: boolean }
  | { type: 'saved'; messageId: string; sessionTitle: string | null }
  | { type: 'error'; message: string };

export type DocumentStatus = 'active' | 'deprecated' | 'superseded';

export interface KbDocument {
  id: number;
  title: string;
  filename: string;
  category: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  status: DocumentStatus;
  supersededById: number | null;
  chunkCount: number;
  pageCount: number;
  uploadedAt: string;
}

export interface IngestJob {
  id: string;
  kind: 'ingest' | 'reingest';
  status: 'queued' | 'running' | 'done' | 'failed';
  progress: string[];
  result: Record<string, unknown> | null;
  error: string | null;
}

export interface AdminUser extends CurrentUser {
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  userId: string;
  action: string;
  target: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface UploadInput {
  file: File;
  title: string;
  category?: string;
  effectiveDate?: string;
  expiryDate?: string;
  forceOcr?: boolean;
  supersedesId?: number | null;
}

// ----------------------------------------------------------- helpers ----

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

function authHeaders(json = true): Record<string, string> {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function errorFrom(res: Response): Promise<ApiError> {
  const data = await res.json().catch(() => null);
  return new ApiError(res.status, (data && data.error) || `Request failed (${res.status})`);
}

/** Authenticated GET of a binary resource (page image, PDF). `<img src>` can't send the Bearer token. */
async function requestBlob(path: string): Promise<Blob> {
  const res = await fetch(`${API_URL}${path}`, { headers: authHeaders(false) });
  if (!res.ok) throw await errorFrom(res);
  return res.blob();
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { ...init, headers: { ...authHeaders(!(init.body instanceof FormData)), ...(init.headers ?? {}) } });
  if (!res.ok) throw await errorFrom(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// -------------------------------------------------------------- auth ----

export const authApi = {
  register: (email: string, password: string, name?: string) =>
    request<AuthResult>('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
  login: (email: string, password: string) =>
    request<AuthResult>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<{ user: CurrentUser }>('/api/auth/me').then((r) => r.user),
};

// ---------------------------------------------------------- sessions ----

export const sessionApi = {
  list: () => request<{ sessions: ChatSession[] }>('/api/sessions').then((r) => r.sessions),
  create: () => request<{ id: string; title: string | null }>('/api/sessions', { method: 'POST', body: '{}' }),
  messages: (id: string) =>
    request<{ id: string; title: string | null; messages: ChatMessage[] }>(`/api/sessions/${id}/messages`),
  rename: (id: string, title: string) =>
    request<{ id: string; title: string }>(`/api/sessions/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  remove: (id: string) => request<void>(`/api/sessions/${id}`, { method: 'DELETE' }),
};

// -------------------------------------------------------------- chat ----

/**
 * Stream one chat turn. Yields normalized events until `saved` or `error`.
 * Parses `text/event-stream` frames (`event: x\ndata: {...}\n\n`); the JSON
 * payload carries `type`, so only the data line is needed.
 */
export async function* streamChat(sessionId: string, question: string, signal?: AbortSignal): AsyncGenerator<ChatStreamEvent> {
  const res = await fetch(`${API_URL}/api/chat/stream`, {
    method: 'POST',
    headers: { ...authHeaders(), accept: 'text/event-stream' },
    body: JSON.stringify({ sessionId, question }),
    signal,
  });
  if (!res.ok) throw await errorFrom(res);
  if (!res.body) throw new ApiError(502, 'empty stream');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const dataLine = frame.split('\n').find((l) => l.startsWith('data:'));
        if (!dataLine) continue;
        let event: ChatStreamEvent;
        try {
          event = JSON.parse(dataLine.slice(5).trim()) as ChatStreamEvent;
        } catch {
          continue;
        }
        yield event;
        if (event.type === 'saved' || event.type === 'error') return;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// --------------------------------------------------------- documents ----

export const documentApi = {
  list: () => request<{ documents: KbDocument[] }>('/api/documents').then((r) => r.documents),
  get: (id: number) => request<KbDocument>(`/api/documents/${id}`),
  /** One page of the original PDF, rendered as an image. */
  page: (id: number, page: number) => requestBlob(`/api/documents/${id}/pages/${page}`),
  file: (id: number) => requestBlob(`/api/documents/${id}/file`),
};

// ------------------------------------------------------------- admin ----

export const adminApi = {
  documents: () => request<{ documents: KbDocument[] }>('/api/admin/documents').then((r) => r.documents),
  upload: (input: UploadInput) => {
    const form = new FormData();
    form.append('file', input.file);
    form.append('title', input.title);
    if (input.category) form.append('category', input.category);
    if (input.effectiveDate) form.append('effectiveDate', input.effectiveDate);
    if (input.expiryDate) form.append('expiryDate', input.expiryDate);
    if (input.forceOcr) form.append('forceOcr', 'true');
    if (input.supersedesId != null) form.append('supersedesId', String(input.supersedesId));
    return request<{ jobId: string; filename: string }>('/api/admin/documents', { method: 'POST', body: form });
  },
  job: (id: string) => request<IngestJob>(`/api/admin/jobs/${id}`),
  supersede: (id: number, byId: number) =>
    request<KbDocument>(`/api/admin/documents/${id}/supersede`, { method: 'POST', body: JSON.stringify({ byId }) }),
  setStatus: (id: number, status: DocumentStatus) =>
    request<KbDocument>(`/api/admin/documents/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  remove: (id: number, deleteFile: boolean) =>
    request<{ deleted: KbDocument }>(`/api/admin/documents/${id}?deleteFile=${deleteFile}`, { method: 'DELETE' }),
  reingest: () => request<{ jobId: string }>('/api/admin/reingest', { method: 'POST', body: '{}' }),
  users: () => request<{ users: AdminUser[] }>('/api/admin/users').then((r) => r.users),
  setRole: (id: string, role: 'user' | 'admin') =>
    request<CurrentUser>(`/api/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  audit: () => request<{ entries: AuditEntry[] }>('/api/admin/audit').then((r) => r.entries),
};

/** Poll a job every `intervalMs` until it finishes; `onTick` sees each snapshot. */
export async function waitForJob(id: string, onTick?: (job: IngestJob) => void, intervalMs = 2000): Promise<IngestJob> {
  for (;;) {
    const job = await adminApi.job(id);
    onTick?.(job);
    if (job.status === 'done' || job.status === 'failed') return job;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
