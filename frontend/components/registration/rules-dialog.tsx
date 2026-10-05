'use client';

import { Button, Chip, Modal, Spinner } from '@heroui/react';
import { Scale } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { SourceViewer } from '../chat/source-viewer';
import { SourceChip } from './rule-issues';
import { useLocalized } from '@/lib/registration';
import { registrationApi, type Citation, type RuleDto } from '@/lib/api';

function paramText(params: Record<string, unknown>): string {
  return Object.entries(params)
    .map(([k, v]) => `${k} = ${String(v)}`)
    .join(', ');
}

/** Every active rule, with its parameters and source — the rule engine made visible. */
export function RulesDialog({ phase }: { phase: 'selection' | 'schedule' }) {
  const t = useTranslations('registration.rules');
  const l = useLocalized();
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState<RuleDto[] | null>(null);
  const [viewing, setViewing] = useState<Citation | null>(null);

  function show() {
    setOpen(true);
    if (!rules) registrationApi.rules().then(setRules).catch(() => setRules([]));
  }

  const ordered = rules ? rules.filter((r) => r.phase === phase).sort((a, b) => a.priority - b.priority) : [];

  return (
    <>
      <Button variant="secondary" size="sm" onPress={show}>
        <Scale className="size-4" />
        {t('view')}
      </Button>
      <Modal isOpen={open} onOpenChange={setOpen}>
        <Modal.Backdrop isDismissable>
          <Modal.Container size="lg" scroll="inside">
            <Modal.Dialog className="max-w-2xl">
              <Modal.Header className="flex-col items-start gap-1">
                <Modal.Heading>{t('title')}</Modal.Heading>
                <p className="text-sm text-muted">{t('subtitle')}</p>
              </Modal.Header>
              <Modal.Body>
                {!rules ? (
                  <div className="flex justify-center py-10">
                    <Spinner />
                  </div>
                ) : (
                  <ul className="flex flex-col divide-y divide-separator">
                    {ordered.map((r) => (
                      <li key={r.code} className="py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{l(r.title)}</span>
                          <Chip size="sm" variant="soft" color={r.severity === 'error' ? 'danger' : 'warning'}>
                            {t(r.severity)}
                          </Chip>
                          <code className="text-[11px] text-muted">{r.code}</code>
                        </div>
                        {r.description && <p className="mt-1 text-sm text-muted">{l(r.description)}</p>}
                        {Object.keys(r.params).length > 0 && <p className="mt-1 font-mono text-xs text-muted">{paramText(r.params)}</p>}
                        {r.source && (
                          <div className="mt-1.5">
                            <SourceChip source={r.source} onOpen={setViewing} />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
      <SourceViewer citation={viewing} onClose={() => setViewing(null)} />
    </>
  );
}
