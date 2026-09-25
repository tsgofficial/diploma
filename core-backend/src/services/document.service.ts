/**
 * Knowledge-base document management. Talks to the engine only through
 * ai.service and records every mutating action in the audit log with the
 * acting admin's id — the engine itself has no notion of users.
 */
import { aiService } from './ai.service';
import { auditRepo } from '../repos/audit.repo';
import { DocumentBinary, DocumentStatus, KbDocument, RagJobWire, UploadDocumentInput } from '../types/document.types';

export const documentService = {
  /** Read-only listing, available to every signed-in user. */
  async list(status?: DocumentStatus): Promise<KbDocument[]> {
    return aiService.listDocuments(status);
  },

  async get(id: number): Promise<KbDocument> {
    return aiService.getDocument(id);
  },

  /** A cited page as printed, for the source viewer. */
  async page(id: number, page: number): Promise<DocumentBinary> {
    return aiService.getDocumentPage(id, page);
  },

  async file(id: number): Promise<DocumentBinary> {
    return aiService.getDocumentFile(id);
  },

  async upload(adminId: string, input: UploadDocumentInput): Promise<{ jobId: string; filename: string }> {
    const job = await aiService.uploadDocument(input);
    await auditRepo.record({
      userId: adminId,
      action: 'document.upload',
      target: job.jobId,
      meta: { title: input.title, filename: job.filename, supersedesId: input.supersedesId ?? null },
    });
    return job;
  },

  async supersede(adminId: string, id: number, byId: number): Promise<KbDocument> {
    const doc = await aiService.supersedeDocument(id, byId);
    await auditRepo.record({ userId: adminId, action: 'document.supersede', target: String(id), meta: { byId } });
    return doc;
  },

  async setStatus(adminId: string, id: number, status: DocumentStatus): Promise<KbDocument> {
    const doc = await aiService.setDocumentStatus(id, status);
    await auditRepo.record({ userId: adminId, action: 'document.status', target: String(id), meta: { status } });
    return doc;
  },

  async remove(adminId: string, id: number, deleteFile: boolean): Promise<KbDocument> {
    const doc = await aiService.deleteDocument(id, deleteFile);
    await auditRepo.record({
      userId: adminId,
      action: 'document.delete',
      target: String(id),
      meta: { title: doc.title, filename: doc.filename, deleteFile },
    });
    return doc;
  },

  async reingest(adminId: string): Promise<{ jobId: string }> {
    const job = await aiService.reingest();
    await auditRepo.record({ userId: adminId, action: 'kb.reingest', target: job.jobId });
    return job;
  },

  async job(id: string): Promise<RagJobWire> {
    return aiService.job(id);
  },

  async jobs(): Promise<RagJobWire[]> {
    return aiService.jobs();
  },
};
