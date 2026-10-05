'use client';

import { Tabs } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { AuditPanel } from '@/components/admin/audit-panel';
import { DocumentsPanel } from '@/components/admin/documents-panel';
import { RegistrationPanel } from '@/components/admin/registration-panel';
import { UsersPanel } from '@/components/admin/users-panel';
import { useShell } from '@/components/shell-context';

export default function AdminPage() {
  const t = useTranslations();
  const { user } = useShell();

  if (user.role !== 'admin') {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <h1 className="text-xl font-semibold">{t('common.notFound')}</h1>
          <p className="mt-2 text-sm text-muted">{t('admin.forbidden')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">{t('admin.title')}</h1>
        <Tabs defaultSelectedKey="documents">
          <Tabs.ListContainer>
            <Tabs.List aria-label={t('admin.title')}>
              <Tabs.Tab id="documents">{t('admin.tabs.documents')}<Tabs.Indicator /></Tabs.Tab>
              <Tabs.Tab id="users">{t('admin.tabs.users')}<Tabs.Indicator /></Tabs.Tab>
              <Tabs.Tab id="audit">{t('admin.tabs.audit')}<Tabs.Indicator /></Tabs.Tab>
              <Tabs.Tab id="registration">{t('admin.tabs.registration')}<Tabs.Indicator /></Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          <Tabs.Panel id="documents" className="pt-6"><DocumentsPanel /></Tabs.Panel>
          <Tabs.Panel id="users" className="pt-6"><UsersPanel /></Tabs.Panel>
          <Tabs.Panel id="audit" className="pt-6"><AuditPanel /></Tabs.Panel>
          <Tabs.Panel id="registration" className="pt-6"><RegistrationPanel /></Tabs.Panel>
        </Tabs>
      </div>
    </div>
  );
}
