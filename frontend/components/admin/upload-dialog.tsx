'use client';

import { Button, Input, Label, ListBox, Modal, Select, Switch, TextField, toast } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { ApiError, adminApi, type KbDocument } from '@/lib/api';

const CATEGORIES = ['handbook', 'regulation', 'journal', 'other'] as const;

export function UploadDialog({ isOpen, onOpenChange, documents, onStarted }: { isOpen: boolean; onOpenChange: (open: boolean) => void; documents: KbDocument[]; onStarted: (jobId: string) => void }) {
  const t = useTranslations();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('regulation');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [supersedes, setSupersedes] = useState<string>('none');
  const [forceOcr, setForceOcr] = useState(false);
  const [busy, setBusy] = useState(false);

  function reset() {
    setFile(null); setTitle(''); setCategory('regulation'); setEffectiveDate(''); setExpiryDate(''); setSupersedes('none'); setForceOcr(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setBusy(true);
    try {
      const { jobId } = await adminApi.upload({
        file, title: title.trim(), category: category === 'other' ? undefined : category,
        effectiveDate: effectiveDate || undefined, expiryDate: expiryDate || undefined, forceOcr,
        supersedesId: supersedes === 'none' ? null : Number(supersedes),
      });
      toast.success(t('admin.uploadStarted'));
      onStarted(jobId);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.danger(err instanceof ApiError ? err.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  const active = documents.filter((d) => d.status === 'active');

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop isDismissable={!busy}>
        <Modal.Container size="md">
          <Modal.Dialog>
            <form onSubmit={submit}>
              <Modal.Header>
                <Modal.Heading>{t('admin.upload')}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>{t('admin.file')}</Label>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    required
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setFile(f);
                      if (f && !title) setTitle(f.name.replace(/\.pdf$/i, ''));
                    }}
                    className="block w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-default file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-default-hover"
                  />
                  <p className="text-xs text-muted">{t('admin.fileHint')}</p>
                </div>
                <TextField value={title} onChange={setTitle} isRequired fullWidth>
                  <Label>{t('admin.titleField')}</Label>
                  <Input />
                </TextField>
                <Select selectedKey={category} onSelectionChange={(k) => setCategory(String(k))} fullWidth>
                  <Label>{t('admin.categoryField')}</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {CATEGORIES.map((c) => (
                        <ListBox.Item key={c} id={c} textValue={t(`documents.categories.${c}`)}>
                          {t(`documents.categories.${c}`)}
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField value={effectiveDate} onChange={setEffectiveDate} type="date" fullWidth>
                    <Label>{t('admin.effectiveDate')}</Label>
                    <Input />
                  </TextField>
                  <TextField value={expiryDate} onChange={setExpiryDate} type="date" fullWidth>
                    <Label>{t('admin.expiryDate')}</Label>
                    <Input />
                  </TextField>
                </div>
                <Select selectedKey={supersedes} onSelectionChange={(k) => setSupersedes(String(k))} fullWidth>
                  <Label>{t('admin.supersedes')}</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="none" textValue={t('admin.none')}>{t('admin.none')}</ListBox.Item>
                      {active.map((d) => (
                        <ListBox.Item key={d.id} id={String(d.id)} textValue={d.title}>{d.title}</ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                <Switch isSelected={forceOcr} onChange={setForceOcr} className="flex items-center gap-2">
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <Switch.Content>{t('admin.forceOcr')}</Switch.Content>
                </Switch>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => onOpenChange(false)} isDisabled={busy}>{t('common.cancel')}</Button>
                <Button type="submit" variant="primary" isDisabled={busy || !file || !title.trim()}>{t('admin.upload')}</Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
