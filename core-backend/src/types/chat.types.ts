/**
 * Shared DTOs for the chat flow and the RAG-engine contract.
 *
 * These mirror the Python engine's actual output: `sources` is a list of
 * document-title strings, `citations` adds page numbers, plus `refused` /
 * `topScore` diagnostics.
 */
import { Citation } from '../models/chatMessage.model';

export interface HistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Body POSTed to the Python rag-engine `/api/chat` and `/api/chat/stream`. */
export interface RagRequest {
  question: string;
  history: HistoryTurn[];
}

/** Citation as the engine sends it (snake_case). */
export interface RagCitationWire {
  doc_title: string;
  document_id?: number | null;
  pages: number[];
}

/** Raw JSON shape returned by the rag-engine (snake_case on the wire). */
export interface RagResponseWire {
  answer: string;
  sources: string[];
  citations?: RagCitationWire[];
  refused: boolean;
  top_score: number;
}

/** Normalized (camelCase) response used inside the backend. */
export interface RagResponse {
  answer: string;
  sources: string[];
  citations: Citation[];
  refused: boolean;
  topScore: number;
}

/**
 * Events on the engine's SSE stream, normalized. The backend re-emits the
 * same shapes to the browser, plus a final `saved` event with the message id.
 */
export type RagStreamEvent =
  | { type: 'status'; stage: 'searching' | 'generating' }
  | { type: 'sources'; sources: string[]; citations: Citation[]; refused: boolean; topScore: number }
  | { type: 'delta'; text: string }
  | { type: 'done'; answer: string; refused: boolean }
  | { type: 'error'; message: string };

export function toCitations(wire: RagCitationWire[] | undefined): Citation[] {
  return (wire ?? []).map((c) => ({ docTitle: c.doc_title, documentId: c.document_id ?? null, pages: c.pages ?? [] }));
}
