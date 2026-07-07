/**
 * Shared DTOs for the chat flow and the RAG-engine contract.
 *
 * These mirror the Python engine's actual output: `sources` is a list of
 * document-title strings, plus `refused` / `topScore` diagnostics.
 */
export interface HistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Body POSTed to the Python rag-engine `/api/chat`. */
export interface RagRequest {
  question: string;
  history: HistoryTurn[];
}

/** Raw JSON shape returned by the rag-engine (snake_case on the wire). */
export interface RagResponseWire {
  answer: string;
  sources: string[];
  refused: boolean;
  top_score: number;
}

/** Normalized (camelCase) response used inside the backend. */
export interface RagResponse {
  answer: string;
  sources: string[];
  refused: boolean;
  topScore: number;
}
