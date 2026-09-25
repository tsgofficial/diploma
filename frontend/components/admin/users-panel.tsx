'use client';

import { Button, Chip, Table, toast } from '@heroui/react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useShell } from '../shell-context';
import { formatDate } from '../documents/document-card';
import { ApiError, adminApi, type AdminUser } from '@/lib/api';

export function UsersPanel() {
  const t = useTranslations();
  const locale = useLocale();
  const { user: me } = useShell();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = () => adminApi.users().then(setUsers).catch((e: Error) => toast.danger(e.message));
  useEffect(() => { void reload(); }, []);

  async function toggle(u: AdminUser) {
    setBusyId(u.id);
    try {
      await adminApi.setRole(u.id, u.role === 'admin' ? 'user' : 'admin');
      toast.success(t('admin.roleUpdated'));
      await reload();
    } catch (err) {
      toast.danger(err instanceof ApiError && err.status === 409 ? t('admin.lastAdmin') : err instanceof ApiError ? err.message : t('common.error'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Table aria-label={t('admin.tabs.users')} className="w-full">
      <Table.ScrollContainer>
        <Table.Content aria-label={t('admin.tabs.users')}>
          <Table.Header>
            <Table.Column isRowHeader>{t('admin.columns.email')}</Table.Column>
            <Table.Column>{t('admin.columns.name')}</Table.Column>
            <Table.Column>{t('admin.columns.role')}</Table.Column>
            <Table.Column>{t('admin.columns.joined')}</Table.Column>
            <Table.Column> </Table.Column>
          </Table.Header>
          <Table.Body items={users}>
            {(u) => (
              <Table.Row id={u.id}>
                <Table.Cell className="font-medium">{u.email}</Table.Cell>
                <Table.Cell>{u.name ?? '—'}</Table.Cell>
                <Table.Cell>
                  <Chip size="sm" variant="soft" color={u.role === 'admin' ? 'accent' : 'default'}>{t(`admin.roles.${u.role}`)}</Chip>
                </Table.Cell>
                <Table.Cell>{formatDate(u.createdAt, locale)}</Table.Cell>
                <Table.Cell>
                  <Button size="sm" variant={u.role === 'admin' ? 'danger-soft' : 'secondary'} isDisabled={busyId === u.id || u.id === me.id} onPress={() => toggle(u)}>
                    {u.role === 'admin' ? t('admin.removeAdmin') : t('admin.makeAdmin')}
                  </Button>
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
