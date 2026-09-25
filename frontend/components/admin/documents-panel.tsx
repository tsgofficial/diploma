'use client';

import { Button, Checkbox, Chip, Dropdown, Label, ListBox, Modal, Select, Table, toast } from '@heroui/react';
import { MoreHorizontal, Plus, RefreshCw } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { JobStatus } from './job-status';
import { UploadDialog } from './upload-dialog';
import { CategoryChip, formatDate } from '../documents/document-card';
import { ApiError, adminApi, waitForJob, type DocumentStatus, type IngestJob, type KbDocument } from '@/lib/api';

const STATUS_COLOR: Record<DocumentStatus, 'success' | 'warning' | 'default'> = { active: 'success', deprecated: 'warning', superseded: 'default' };

export function DocumentsPanel() {
  const t = useTranslations();
  const locale = useLocale();
  const [docs, setDocs] = useState<KbDocument[]>([]);
  const [job, setJob] = useState<IngestJob | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [supersedeTarget, setSupersedeTarget] = useState<KbDocument | null>(null);
  const [supersedeBy, setSupersedeBy] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<KbDocument | null>(null);
  const [deleteFile, setDeleteFile] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => adminApi.documents().then(setDocs).catch((e: Error) => toast.danger(e.message)), []);
  useEffect(() => { void reload(); }, [reload]);

  function track(jobId: string) {
    setJob(null);
    void waitForJob(jobId, setJob).then((final) => {
      toast[final.status === 'done' ? 'success' : 'danger'](final.status === 'done' ? t('admin.jobDone') : `${t('admin.jobFailed')}: ${final.error ?? ''}`);
      void reload();
    });
  }

  async function run(fn: () => Promise<unknown>, okMessage: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(okMessage);
      await reload();
    } catch (err) {
      toast.danger(err instanceof ApiError ? err.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  function onAction(doc: KbDocument, key: React.Key) {
    switch (String(key)) {
      case 'activate': return run(() => adminApi.setStatus(doc.id, 'active'), t('admin.updated'));
      case 'deprecate': return run(() => adminApi.setStatus(doc.id, 'deprecated'), t('admin.updated'));
      case 'supersede': setSupersedeTarget(doc); setSupersedeBy(''); return;
      case 'delete': setDeleteTarget(doc); setDeleteFile(false); return;
    }
  }

  const jobBusy = job !== null && (job.status === 'queued' || job.status === 'running');

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onPress={() => setUploadOpen(true)} isDisabled={jobBusy}>
          <Plus className="size-4" /> {t('admin.upload')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          isDisabled={jobBusy}
          onPress={() => {
            if (!window.confirm(t('admin.reingestConfirm'))) return;
            adminApi.reingest().then(({ jobId }) => { toast.success(t('admin.reingestStarted')); track(jobId); }).catch((e: Error) => toast.danger(e.message));
          }}
        >
          <RefreshCw className="size-4" /> {t('admin.reingest')}
        </Button>
      </div>

      <JobStatus job={job} />

      <Table aria-label={t('admin.tabs.documents')} className="w-full">
        <Table.ScrollContainer>
          <Table.Content aria-label={t('admin.tabs.documents')}>
            <Table.Header>
              <Table.Column isRowHeader>{t('admin.columns.title')}</Table.Column>
              <Table.Column>{t('admin.columns.status')}</Table.Column>
              <Table.Column>{t('admin.columns.pages')}</Table.Column>
              <Table.Column>{t('admin.columns.chunks')}</Table.Column>
              <Table.Column>{t('admin.columns.effective')}</Table.Column>
              <Table.Column>{t('admin.columns.uploaded')}</Table.Column>
              <Table.Column> </Table.Column>
            </Table.Header>
            <Table.Body items={docs} renderEmptyState={() => <div className="p-6 text-center text-sm text-muted">{t('documents.empty')}</div>}>
              {(doc) => (
                <Table.Row id={doc.id}>
                  <Table.Cell>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{doc.title}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                        <CategoryChip category={doc.category} />
                        <span className="truncate">{doc.filename}</span>
                      </span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Chip size="sm" variant="soft" color={STATUS_COLOR[doc.status]}>{t(`documents.status.${doc.status}`)}</Chip>
                    {doc.supersededById != null && <span className="ml-1 text-xs text-muted">→ #{doc.supersededById}</span>}
                  </Table.Cell>
                  <Table.Cell className="tabular-nums">{doc.pageCount}</Table.Cell>
                  <Table.Cell className="tabular-nums">{doc.chunkCount}</Table.Cell>
                  <Table.Cell>{formatDate(doc.effectiveDate, locale)}</Table.Cell>
                  <Table.Cell>{formatDate(doc.uploadedAt, locale)}</Table.Cell>
                  <Table.Cell>
                    <Dropdown>
                      <Dropdown.Trigger aria-label={t('admin.actions')} isDisabled={busy || jobBusy} className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-default hover:text-foreground">
                        <MoreHorizontal className="size-4" />
                      </Dropdown.Trigger>
                      <Dropdown.Popover placement="bottom end">
                        <Dropdown.Menu onAction={(key) => onAction(doc, key)}>
                          {doc.status === 'active' ? (
                            <Dropdown.Item id="deprecate" textValue={t('admin.deprecate')}>{t('admin.deprecate')}</Dropdown.Item>
                          ) : (
                            <Dropdown.Item id="activate" textValue={t('admin.activate')}>{t('admin.activate')}</Dropdown.Item>
                          )}
                          <Dropdown.Item id="supersede" textValue={t('admin.supersede')}>{t('admin.supersede')}</Dropdown.Item>
                          <Dropdown.Item id="delete" textValue={t('admin.deleteDoc')} className="text-danger">{t('admin.deleteDoc')}</Dropdown.Item>
                        </Dropdown.Menu>
                      </Dropdown.Popover>
                    </Dropdown>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      <UploadDialog isOpen={uploadOpen} onOpenChange={setUploadOpen} documents={docs} onStarted={track} />

      {/* Supersede */}
      <Modal isOpen={supersedeTarget !== null} onOpenChange={(open) => !open && setSupersedeTarget(null)}>
        <Modal.Backdrop isDismissable>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.Header><Modal.Heading>{t('admin.supersede')}</Modal.Heading></Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                <p className="text-sm text-muted">{supersedeTarget?.title}</p>
                <Select selectedKey={supersedeBy || null} onSelectionChange={(k) => setSupersedeBy(String(k))} fullWidth>
                  <Label>{t('admin.supersedeBy')}</Label>
                  <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {docs.filter((d) => d.id !== supersedeTarget?.id).map((d) => (
                        <ListBox.Item key={d.id} id={String(d.id)} textValue={d.title}>{d.title}</ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setSupersedeTarget(null)}>{t('common.cancel')}</Button>
                <Button
                  variant="primary"
                  isDisabled={!supersedeBy || busy}
                  onPress={() => {
                    const target = supersedeTarget;
                    setSupersedeTarget(null);
                    if (target) void run(() => adminApi.supersede(target.id, Number(supersedeBy)), t('admin.updated'));
                  }}
                >
                  {t('common.confirm')}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Delete */}
      <Modal isOpen={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <Modal.Backdrop isDismissable>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.Header><Modal.Heading>{t('admin.deleteDoc')}</Modal.Heading></Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                <p className="text-sm">{t('admin.deleteConfirm', { title: deleteTarget?.title ?? '' })}</p>
                <Checkbox isSelected={deleteFile} onChange={setDeleteFile}>
                  <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
                  <Checkbox.Content>{t('admin.deleteFile')}</Checkbox.Content>
                </Checkbox>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
                <Button
                  variant="danger"
                  isDisabled={busy}
                  onPress={() => {
                    const target = deleteTarget;
                    setDeleteTarget(null);
                    if (target) void run(() => adminApi.remove(target.id, deleteFile), t('admin.deleted'));
                  }}
                >
                  {t('common.delete')}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
