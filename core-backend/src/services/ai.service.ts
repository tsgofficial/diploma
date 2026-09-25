/**
 * HTTP client for the decoupled Python rag-engine.
 *
 * This is the ONLY module that talks to the engine. It is a pure transport
 * adapter — it does no persistence and holds no business logic. Uses the native
 * `fetch` (Node 18+) with an abort-based timeout. Three groups of calls:
 *   - chat:      query() (one shot) and stream() (server-sent events)
 *   - documents: list / get / page / file / upload / supersede / setStatus / remove / reingest
 *   - jobs:      job() / jobs() for the engine's background ingest work
 */
import { env } from '../config/env';
import { createHttpError } from '../utils/httpError';
import {
  RagRequest,
  RagResponse,
  RagResponseWire,
  RagStreamEvent,
  toCitations,
} from '../types/chat.types';
import {
  DocumentBinary,
  DocumentStatus,
  KbDocument,
  RagDocumentWire,
  RagJobWire,
  UploadDocumentInput,
  toKbDocument,
} from '../types/document.types';

const baseHeaders = { 'x-internal-key': env.RAG_INTERNAL_KEY };

/** fetch() against the engine with a timeout and uniform error mapping. */
async function engineFetch(path: string, init: RequestInit, timeoutMs = env.RAG_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${env.RAG_ENGINE_URL}${path}`, {
      ...init,
      headers: { ...baseHeaders, ...(init.headers ?? {}) },
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      // 404/409/422 from the engine are the caller's problem; pass the status through.
      const status = res.status >= 400 && res.status < 500 ? res.status : 502;
      throw createHttpError(status, `rag-engine error (${res.status}): ${detail.slice(0, 300)}`);
    }
    return res;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw createHttpError(504, 'rag-engine request timed out');
    }
    if (err instanceof Error && 'status' in err) throw err;
    throw createHttpError(502, 'rag-engine request failed');
  } finally {
    clearTimeout(timer); // one-shot calls only; stream() manages its own deadline
  }
}

async function engineJson<T>(path: string, init: RequestInit = {}, timeoutMs?: number): Promise<T> {
  const res = await engineFetch(path, init, timeoutMs);
  return (await res.json()) as T;
}

/**
 * Parse a text/event-stream body into events. Each event is
 * `event: <type>\ndata: <json>\n\n`; we only need the data line since the
 * JSON payload carries `type` itself.
 */
async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const dataLine = raw.split('\n').find((l) => l.startsWith('data:'));
      if (!dataLine) continue;
      try {
        yield JSON.parse(dataLine.slice(5).trim()) as Record<string, unknown>;
      } catch {
        // malformed frame — skip rather than kill the stream
      }
    }
  }
}

function normalizeEvent(e: Record<string, unknown>): RagStreamEvent | null {
  switch (e.type) {
    case 'status':
      return { type: 'status', stage: e.stage === 'generating' ? 'generating' : 'searching' };
    case 'sources':
      return {
        type: 'sources',
        sources: (e.sources as string[]) ?? [],
        citations: toCitations(e.citations as RagResponseWire['citations']),
        refused: Boolean(e.refused),
        topScore: Number(e.top_score ?? 0),
      };
    case 'delta':
      return { type: 'delta', text: String(e.text ?? '') };
    case 'done':
      return { type: 'done', answer: String(e.answer ?? ''), refused: Boolean(e.refused) };
    case 'error':
      return { type: 'error', message: String(e.message ?? 'engine error') };
    default:
      return null;
  }
}

export const aiService = {
  // ------------------------------------------------------------- chat ----

  async query(payload: RagRequest): Promise<RagResponse> {
    const wire = await engineJson<RagResponseWire>('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return {
      answer: wire.answer,
      sources: wire.sources ?? [],
      citations: toCitations(wire.citations),
      refused: Boolean(wire.refused),
      topScore: wire.top_score ?? 0,
    };
  },

  /**
   * Stream one chat turn as normalized events. The generator ends after the
   * engine's `done` (or `error`) event. Generation can run well past the
   * one-shot timeout, so the stream gets its own, longer deadline.
   */
  async *stream(payload: RagRequest): AsyncGenerator<RagStreamEvent> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.RAG_TIMEOUT_MS * 4);
    let res: Response;
    try {
      res = await fetch(`${env.RAG_ENGINE_URL}/api/chat/stream`, {
        method: 'POST',
        headers: { ...baseHeaders, 'Content-Type': 'application/json', accept: 'text/event-stream' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === 'AbortError') throw createHttpError(504, 'rag-engine request timed out');
      throw createHttpError(502, 'rag-engine request failed');
    }
    if (!res.ok || !res.body) {
      clearTimeout(timer);
      const detail = await res.text().catch(() => '');
      throw createHttpError(502, `rag-engine error (${res.status}): ${detail.slice(0, 300)}`);
    }
    try {
      for await (const raw of parseSse(res.body)) {
        const event = normalizeEvent(raw);
        if (!event) continue;
        yield event;
        if (event.type === 'done' || event.type === 'error') return;
      }
    } finally {
      clearTimeout(timer);
    }
  },

  // -------------------------------------------------------- documents ----

  async listDocuments(status?: DocumentStatus): Promise<KbDocument[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    const data = await engineJson<{ documents: RagDocumentWire[] }>(`/api/admin/documents${qs}`, {});
    return data.documents.map(toKbDocument);
  },

  async getDocument(id: number): Promise<KbDocument> {
    return toKbDocument(await engineJson<RagDocumentWire>(`/api/admin/documents/${id}`, {}));
  },

  /** One page of the original PDF, rendered by the engine as a PNG. */
  async getDocumentPage(id: number, page: number): Promise<DocumentBinary> {
    const res = await engineFetch(`/api/admin/documents/${id}/pages/${page}`, {});
    return { data: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') ?? 'image/png' };
  },

  /** The original PDF as uploaded. */
  async getDocumentFile(id: number): Promise<DocumentBinary> {
    const res = await engineFetch(`/api/admin/documents/${id}/file`, {}, env.RAG_UPLOAD_TIMEOUT_MS);
    return { data: Buffer.from(await res.arrayBuffer()), contentType: 'application/pdf' };
  },

  /** Multipart upload; the engine stores the PDF and returns an ingest job id. */
  async uploadDocument(input: UploadDocumentInput): Promise<{ jobId: string; filename: string }> {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(input.buffer)], { type: 'application/pdf' }), input.filename);
    form.append('title', input.title);
    if (input.category) form.append('category', input.category);
    if (input.effectiveDate) form.append('effective_date', input.effectiveDate);
    if (input.expiryDate) form.append('expiry_date', input.expiryDate);
    if (input.forceOcr) form.append('force_ocr', 'true');
    if (input.supersedesId != null) form.append('supersedes_id', String(input.supersedesId));

    const data = await engineJson<{ job_id: string; filename: string }>(
      '/api/admin/documents',
      { method: 'POST', body: form },
      env.RAG_UPLOAD_TIMEOUT_MS
    );
    return { jobId: data.job_id, filename: data.filename };
  },

  async supersedeDocument(id: number, byId: number): Promise<KbDocument> {
    return toKbDocument(
      await engineJson<RagDocumentWire>(`/api/admin/documents/${id}/supersede?by=${byId}`, { method: 'POST' })
    );
  },

  async setDocumentStatus(id: number, status: DocumentStatus): Promise<KbDocument> {
    return toKbDocument(
      await engineJson<RagDocumentWire>(`/api/admin/documents/${id}/status?new_status=${status}`, { method: 'PATCH' })
    );
  },

  async deleteDocument(id: number, deleteFile: boolean): Promise<KbDocument> {
    const data = await engineJson<{ deleted: RagDocumentWire }>(
      `/api/admin/documents/${id}?delete_file=${deleteFile ? 'true' : 'false'}`,
      { method: 'DELETE' }
    );
    return toKbDocument(data.deleted);
  },

  async reingest(): Promise<{ jobId: string }> {
    const data = await engineJson<{ job_id: string }>('/api/admin/reingest', { method: 'POST' });
    return { jobId: data.job_id };
  },

  // ------------------------------------------------------------- jobs ----

  async job(id: string): Promise<RagJobWire> {
    return engineJson<RagJobWire>(`/api/admin/jobs/${encodeURIComponent(id)}`, {});
  },

  async jobs(): Promise<RagJobWire[]> {
    return (await engineJson<{ jobs: RagJobWire[] }>('/api/admin/jobs', {})).jobs;
  },
};
