'use client';

import { Button, Modal, Spinner } from '@heroui/react';
import { ChevronLeft, ChevronRight, ExternalLink, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { documentApi, type Citation, type KbDocument } from '@/lib/api';

/**
 * The cited document: by id while it still carries the cited title (rebuilding
 * the knowledge base renumbers ids), otherwise by title among active documents.
 */
async function resolveDocument(c: Citation): Promise<KbDocument | null> {
  if (c.documentId) {
    const doc = await documentApi.get(c.documentId).catch(() => null);
    if (doc && doc.title === c.docTitle) return doc;
  }
  const docs = await documentApi.list();
  return docs.find((d) => d.title === c.docTitle) ?? null;
}

/**
 * Shows the cited pages of the original PDF exactly as printed (rendered to
 * images by the engine), with paging through the whole document and a link
 * to open the full PDF.
 */
export function SourceViewer({ citation, onClose }: { citation: Citation | null; onClose: () => void }) {
  const t = useTranslations();
  const [doc, setDoc] = useState<KbDocument | null>(null);
  const [missing, setMissing] = useState(false);
  const [page, setPage] = useState(1);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const cache = useRef(new Map<number, string>()); // page → object URL, for the open document

  const clearCache = useCallback(() => {
    cache.current.forEach((url) => URL.revokeObjectURL(url));
    cache.current.clear();
  }, []);

  useEffect(() => {
    if (!citation) return;
    let cancelled = false;
    setDoc(null);
    setMissing(false);
    setImgUrl(null);
    setPage(citation.pages[0] ?? 1);
    resolveDocument(citation)
      .then((d) => {
        if (cancelled) return;
        setDoc(d);
        setMissing(!d);
      })
      .catch(() => !cancelled && setMissing(true));
    return () => {
      cancelled = true;
      clearCache();
    };
  }, [citation, clearCache]);

  useEffect(() => {
    if (!doc) return;
    const cached = cache.current.get(page);
    if (cached) {
      setImgUrl(cached);
      setImgError(false);
      return;
    }
    let cancelled = false;
    setImgLoading(true);
    setImgError(false);
    documentApi
      .page(doc.id, page)
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        cache.current.set(page, url);
        setImgUrl(url);
      })
      .catch(() => !cancelled && setImgError(true))
      .finally(() => !cancelled && setImgLoading(false));
    return () => {
      cancelled = true;
    };
  }, [doc, page]);

  const lastPage = doc?.pageCount || Number.POSITIVE_INFINITY;
  const go = useCallback((p: number) => setPage((cur) => (p >= 1 && p <= lastPage ? p : cur)), [lastPage]);

  useEffect(() => {
    if (!doc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(page - 1);
      if (e.key === 'ArrowRight') go(page + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doc, page, go]);

  async function openPdf() {
    if (!doc) return;
    // Open the tab synchronously (popup blockers), then point it at the PDF once fetched.
    const tab = window.open('', '_blank');
    try {
      const url = URL.createObjectURL(await documentApi.file(doc.id));
      if (tab) tab.location.href = `${url}#page=${page}`;
      else window.location.assign(`${url}#page=${page}`);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      tab?.close();
      setImgError(true);
    }
  }

  const title = doc?.title ?? citation?.docTitle ?? '';
  const cited = citation?.pages ?? [];

  return (
    <Modal isOpen={citation !== null} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop isDismissable>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog className="max-w-3xl">
            <Modal.Header className="flex-col items-start gap-2">
              <Modal.Heading className="flex min-w-0 items-center gap-2 text-base">
                <FileText className="size-4 shrink-0 text-muted" />
                <span className="truncate">{title}</span>
              </Modal.Heading>
              {cited.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  <span>{t('viewer.citedPages')}:</span>
                  {cited.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => go(p)}
                      className={`rounded-md px-2 py-0.5 tabular-nums transition-colors ${
                        p === page ? 'bg-accent text-accent-foreground' : 'bg-default hover:bg-default-hover'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </Modal.Header>

            <Modal.Body>
              {missing ? (
                <p className="py-10 text-center text-sm text-muted">{t('viewer.missing')}</p>
              ) : (
                <div className="relative flex min-h-[50vh] items-start justify-center rounded-xl bg-default p-2">
                  {/* Plain <img>: the src is a blob URL from an authenticated fetch, which next/image can't load. */}
                  {imgUrl && (
                    <img
                      src={imgUrl}
                      alt={`${title} — ${t('common.pages')} ${page}`}
                      className={`h-auto w-full max-w-[720px] rounded-md bg-white shadow-sm transition-opacity ${imgLoading ? 'opacity-40' : ''}`}
                    />
                  )}
                  {(imgLoading || (!doc && !missing)) && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Spinner />
                    </div>
                  )}
                  {imgError && !imgLoading && (
                    <p className="absolute inset-x-0 top-1/3 text-center text-sm text-danger">{t('viewer.pageError')}</p>
                  )}
                </div>
              )}
            </Modal.Body>

            <Modal.Footer className="flex-wrap justify-between gap-2">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" isIconOnly aria-label={t('viewer.prev')} isDisabled={!doc || page <= 1} onPress={() => go(page - 1)}>
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="min-w-20 text-center text-sm tabular-nums text-muted">
                  {t('common.pages')} {page}
                  {doc?.pageCount ? ` / ${doc.pageCount}` : ''}
                </span>
                <Button variant="ghost" size="sm" isIconOnly aria-label={t('viewer.next')} isDisabled={!doc || page >= lastPage} onPress={() => go(page + 1)}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" isDisabled={!doc} onPress={openPdf}>
                  <ExternalLink className="size-4" />
                  {t('viewer.openPdf')}
                </Button>
                <Button variant="ghost" size="sm" onPress={onClose}>
                  {t('common.close')}
                </Button>
              </div>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
