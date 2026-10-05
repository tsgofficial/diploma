'use client';

import { Chip, ListBox, Select, Table, toast } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useLocalized } from '@/lib/registration';
import { ApiError, registrationApi, type RegTerm, type TermPhase } from '@/lib/api';

const PHASES: TermPhase[] = ['upcoming', 'selection', 'schedule', 'in_progress', 'closed'];

/** Registrar: move a term between Хичээл сонголт 1 and 2 (and close it). */
export function RegistrationPanel() {
  const t = useTranslations('registration');
  const l = useLocalized();
  const [terms, setTerms] = useState<RegTerm[]>([]);

  const reload = () => registrationApi.terms().then(setTerms).catch((e: Error) => toast.danger(e.message));
  useEffect(() => {
    void reload();
  }, []);

  async function change(term: RegTerm, phase: TermPhase) {
    if (phase === term.phase) return;
    try {
      await registrationApi.setPhase(term.id, phase);
      toast.success(t('admin.updated'));
      await reload();
    } catch (err) {
      toast.danger(err instanceof ApiError ? err.message : String(err));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="font-medium">{t('admin.title')}</h2>
        <p className="text-sm text-muted">{t('admin.subtitle')}</p>
      </div>
      <Table aria-label={t('admin.title')} className="w-full">
        <Table.ScrollContainer>
          <Table.Content aria-label={t('admin.title')}>
            <Table.Header>
              <Table.Column isRowHeader>{t('admin.title')}</Table.Column>
              <Table.Column>{t('admin.phase')}</Table.Column>
            </Table.Header>
            <Table.Body items={terms}>
              {(term) => (
                <Table.Row id={term.id}>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{l(term.name)}</span>
                      {term.isCurrent && (
                        <Chip size="sm" variant="soft" color="accent">
                          {t('admin.current')}
                        </Chip>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Select aria-label={t('admin.phase')} selectedKey={term.phase} onSelectionChange={(k) => change(term, k as TermPhase)} className="w-56">
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {PHASES.map((p) => (
                            <ListBox.Item key={p} id={p} textValue={t(`phase.${p}`)}>
                              {t(`phase.${p}`)}
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </div>
  );
}
