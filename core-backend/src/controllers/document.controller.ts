/**
 * Document controllers — the read-only list for users and the management
 * endpoints for admins. Input validation at the edge, delegation to the
 * service, nothing else.
 */
import { Request, Response, NextFunction } from 'express';
import { documentService } from '../services/document.service';
import { createHttpError } from '../utils/httpError';
import { DocumentStatus } from '../types/document.types';

const STATUSES: DocumentStatus[] = ['active', 'deprecated', 'superseded'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw createHttpError(400, 'invalid document id');
  return id;
}

function parseStatus(raw: unknown): DocumentStatus | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string' || !STATUSES.includes(raw as DocumentStatus)) {
    throw createHttpError(400, `status must be one of ${STATUSES.join(', ')}`);
  }
  return raw as DocumentStatus;
}

function optionalDate(raw: unknown, field: string): string | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw !== 'string' || !DATE_RE.test(raw)) throw createHttpError(400, `${field} must be YYYY-MM-DD`);
  return raw;
}

export const documentController = {
  /** GET /api/documents — every signed-in user; defaults to active only. */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = parseStatus(req.query.status) ?? 'active';
      res.json({ documents: await documentService.list(status) });
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/admin/documents — admins see every status. */
  async listAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({ documents: await documentService.list(parseStatus(req.query.status)) });
    } catch (err) {
      next(err);
    }
  },

  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await documentService.get(parseId(req.params.id)));
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/documents/:id/pages/:page — PNG of one page of the original PDF. */
  async page(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Number(req.params.page);
      if (!Number.isInteger(page) || page <= 0) throw createHttpError(400, 'invalid page number');
      const png = await documentService.page(parseId(req.params.id), page);
      res.set({ 'Content-Type': png.contentType, 'Cache-Control': 'private, max-age=3600' }).send(png.data);
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/documents/:id/file — the original PDF, shown inline. */
  async file(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const pdf = await documentService.file(parseId(req.params.id));
      res.set({ 'Content-Type': pdf.contentType, 'Content-Disposition': 'inline' }).send(pdf.data);
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/admin/documents — multipart: file + title [+ category, dates, supersedesId]. */
  async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = req.file;
      if (!file) throw createHttpError(400, 'a PDF file is required (field "file")');
      const { title, category, effectiveDate, expiryDate, forceOcr, supersedesId } = req.body ?? {};
      if (typeof title !== 'string' || !title.trim()) throw createHttpError(400, 'title is required');

      const job = await documentService.upload(req.userId as string, {
        buffer: file.buffer,
        filename: file.originalname || 'document.pdf',
        title: title.trim(),
        category: typeof category === 'string' && category.trim() ? category.trim() : null,
        effectiveDate: optionalDate(effectiveDate, 'effectiveDate'),
        expiryDate: optionalDate(expiryDate, 'expiryDate'),
        forceOcr: forceOcr === 'true' || forceOcr === true,
        supersedesId: supersedesId ? parseId(String(supersedesId)) : null,
      });
      res.status(202).json(job);
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/admin/documents/:id/supersede { byId } */
  async supersede(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseId(req.params.id);
      const byId = parseId(String(req.body?.byId ?? ''));
      res.json(await documentService.supersede(req.userId as string, id, byId));
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/admin/documents/:id/status { status } */
  async setStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = parseStatus(req.body?.status);
      if (!status) throw createHttpError(400, 'status is required');
      res.json(await documentService.setStatus(req.userId as string, parseId(req.params.id), status));
    } catch (err) {
      next(err);
    }
  },

  /** DELETE /api/admin/documents/:id?deleteFile=true */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deleteFile = req.query.deleteFile === 'true';
      res.json({ deleted: await documentService.remove(req.userId as string, parseId(req.params.id), deleteFile) });
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/admin/reingest */
  async reingest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(202).json(await documentService.reingest(req.userId as string));
    } catch (err) {
      next(err);
    }
  },

  async job(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await documentService.job(req.params.id));
    } catch (err) {
      next(err);
    }
  },

  async jobs(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({ jobs: await documentService.jobs() });
    } catch (err) {
      next(err);
    }
  },
};
