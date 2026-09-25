'use client';

import { Table, toast } from '@heroui/react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { adminApi, type AdminUser, type AuditEntry } from '@/lib/api';

export function AuditPanel() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [users, setUsers] = useState<Record<string, AdminUser>>({});

  useEffect(() => {
    Promise.all([adminApi.audit(), adminApi.users()])
      .then(([a, u]) => {
        setEntries(a);
        setUsers(Object.fromEntries(u.map((x) => [x.id, x])));
      })
      .catch((e: Error) => toast.danger(e.message));
  }, []);

  const when = (iso: string) => {
    const d = new Date(iso);
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (locale === 'mn') return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${time}`;
    return `${d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })} ${time}`;
  };

  return (
    <Table aria-label={t('tabs.audit')} className="w-full">
      <Table.ScrollContainer>
        <Table.Content aria-label={t('tabs.audit')}>
          <Table.Header>
            <Table.Column isRowHeader>{t('columns.when')}</Table.Column>
            <Table.Column>{t('columns.by')}</Table.Column>
            <Table.Column>{t('columns.action')}</Table.Column>
            <Table.Column>{t('columns.target')}</Table.Column>
          </Table.Header>
          <Table.Body items={entries}>
            {(e) => (
              <Table.Row id={e.id}>
                <Table.Cell className="whitespace-nowrap tabular-nums">{when(e.createdAt)}</Table.Cell>
                <Table.Cell>{users[e.userId]?.email ?? e.userId.slice(0, 8)}</Table.Cell>
                <Table.Cell><code className="rounded bg-default px-1.5 py-0.5 text-xs">{e.action}</code></Table.Cell>
                <Table.Cell className="max-w-xs truncate text-muted">
                  {(e.meta && typeof e.meta.title === 'string' && e.meta.title) || e.target || '—'}
                  {e.meta && typeof e.meta.status === 'string' && ` → ${e.meta.status}`}
                  {e.meta && typeof e.meta.role === 'string' && ` → ${e.meta.role}`}
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
