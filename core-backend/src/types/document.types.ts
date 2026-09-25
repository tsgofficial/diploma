/**
 * Knowledge-base document DTOs — the engine's SQLite `documents` row on the
 * wire (snake_case) and the camelCase form the API exposes.
 */
export type DocumentStatus = 'active' | 'deprecated' | 'superseded';

export interface RagDocumentWire {
  id: number;
  title: string;
  filename: string;
  category: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  status: DocumentStatus;
  superseded_by_id: number | null;
  chunk_count: number;
  page_count: number;
  uploaded_at: string;
}

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

/** A binary file relayed from the engine (a rendered page or the original PDF). */
export interface DocumentBinary {
  data: Buffer;
  contentType: string;
}

export interface RagJobWire {
  id: string;
  kind: 'ingest' | 'reingest';
  status: 'queued' | 'running' | 'done' | 'failed';
  progress: string[];
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: number;
  started_at: number | null;
  finished_at: number | null;
}

export interface UploadDocumentInput {
  buffer: Buffer;
  filename: string;
  title: string;
  category?: string | null;
  effectiveDate?: string | null;
  expiryDate?: string | null;
  forceOcr?: boolean;
  supersedesId?: number | null;
}

export function toKbDocument(w: RagDocumentWire): KbDocument {
  return {
    id: w.id,
    title: w.title,
    filename: w.filename,
    category: w.category,
    effectiveDate: w.effective_date,
    expiryDate: w.expiry_date,
    status: w.status,
    supersededById: w.superseded_by_id,
    chunkCount: w.chunk_count,
    pageCount: w.page_count ?? 0,
    uploadedAt: w.uploaded_at,
  };
}
