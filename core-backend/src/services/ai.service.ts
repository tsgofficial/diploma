/**
 * HTTP client for the decoupled Python rag-engine.
 *
 * This is the ONLY module that talks to the engine. It is a pure transport
 * adapter — it does no persistence and holds no business logic. Uses the native
 * `fetch` (Node 18+) with an abort-based timeout.
 */
import { env } from '../config/env';
import { createHttpError } from '../utils/httpError';
import { RagRequest, RagResponse, RagResponseWire } from '../types/chat.types';

export const aiService = {
  async query(payload: RagRequest): Promise<RagResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.RAG_TIMEOUT_MS);

    try {
      const res = await fetch(`${env.RAG_ENGINE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Shared secret — only the backend may reach the internal engine.
          'x-internal-key': env.RAG_INTERNAL_KEY,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw createHttpError(502, `rag-engine error (${res.status}): ${detail}`);
      }

      const wire = (await res.json()) as RagResponseWire;

      // Normalize the wire (snake_case) shape into the backend's camelCase DTO.
      return {
        answer: wire.answer,
        sources: wire.sources ?? [],
        refused: Boolean(wire.refused),
        topScore: wire.top_score ?? 0,
      };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw createHttpError(504, 'rag-engine request timed out');
      }
      // Re-throw HttpErrors as-is; wrap anything else (e.g. connection refused).
      if (err instanceof Error && 'status' in err) throw err;
      throw createHttpError(502, 'rag-engine request failed');
    } finally {
      clearTimeout(timer);
    }
  },
};
