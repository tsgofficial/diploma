'use client';

import { Button, Dropdown, Tooltip } from '@heroui/react';
import { FileText, MessageSquarePlus, MoreHorizontal, Pencil, Shield, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useShell } from './shell-context';
import { UserMenu } from './user-menu';
import { sessionApi, type ChatSession } from '@/lib/api';

function NavLink({ href, active, icon, children, onNavigate }: { href: string; active: boolean; icon: React.ReactNode; children: React.ReactNode; onNavigate: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${active ? 'bg-default text-foreground' : 'text-muted hover:bg-default/60 hover:text-foreground'}`}
    >
      {icon}
      <span className="truncate">{children}</span>
    </Link>
  );
}

function SessionRow({ session, active }: { session: ChatSession; active: boolean }) {
  const t = useTranslations('chat');
  const router = useRouter();
  const { upsertSession, removeSession, closeMobileNav } = useShell();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(session.title ?? '');
  const title = session.title || t('untitled');

  async function commitRename() {
    setRenaming(false);
    const next = draft.trim();
    if (!next || next === session.title) return;
    const updated = await sessionApi.rename(session.id, next).catch(() => null);
    if (updated) upsertSession({ ...session, title: updated.title });
  }

  async function remove() {
    if (!window.confirm(t('deleteConfirm'))) return;
    await sessionApi.remove(session.id).catch(() => null);
    removeSession(session.id);
    if (active) router.push('/chat');
  }

  if (renaming) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitRename();
          if (e.key === 'Escape') setRenaming(false);
        }}
        className="w-full rounded-xl bg-default px-3 py-2 text-sm outline-none ring-2 ring-focus"
      />
    );
  }

  return (
    <div className={`group flex items-center rounded-xl pr-1 ${active ? 'bg-default' : 'hover:bg-default/60'}`}>
      <Link href={`/chat/${session.id}`} onClick={closeMobileNav} className="min-w-0 flex-1 truncate px-3 py-2 text-sm" title={title}>
        {title}
      </Link>
      <Dropdown>
        <Dropdown.Trigger aria-label={t('rename')} className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted opacity-0 transition-opacity hover:bg-default-hover hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[pressed]:opacity-100">
          <MoreHorizontal className="size-4" />
        </Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu onAction={(key) => (key === 'rename' ? (setDraft(session.title ?? ''), setRenaming(true)) : remove())}>
            <Dropdown.Item id="rename" textValue={t('rename')}>
              <Pencil className="size-4" /> {t('rename')}
            </Dropdown.Item>
            <Dropdown.Item id="delete" textValue={t('deleteChat')} className="text-danger">
              <Trash2 className="size-4" /> {t('deleteChat')}
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
}

export function Sidebar() {
  const t = useTranslations();
  const pathname = usePathname();
  const { user, sessions, sessionsLoading, closeMobileNav } = useShell();
  const activeId = pathname.startsWith('/chat/') ? pathname.slice('/chat/'.length) : null;

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex items-center justify-between px-1 pb-1 pt-1">
        <Link href="/chat" onClick={closeMobileNav} className="truncate text-sm font-semibold">
          {t('app.name')}
        </Link>
        <Tooltip>
          <Tooltip.Trigger>
            <Button variant="ghost" size="sm" isIconOnly aria-label={t('nav.newChat')} onPress={() => { closeMobileNav(); window.location.assign('/chat'); }}>
              <MessageSquarePlus className="size-4" />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>{t('nav.newChat')}</Tooltip.Content>
        </Tooltip>
      </div>

      <nav className="flex flex-col gap-0.5">
        <NavLink href="/documents" active={pathname.startsWith('/documents')} icon={<FileText className="size-4" />} onNavigate={closeMobileNav}>
          {t('nav.documents')}
        </NavLink>
        {user.role === 'admin' && (
          <NavLink href="/admin" active={pathname.startsWith('/admin')} icon={<Shield className="size-4" />} onNavigate={closeMobileNav}>
            {t('nav.admin')}
          </NavLink>
        )}
      </nav>

      <div className="mt-2 px-3 text-[11px] font-medium uppercase tracking-wide text-muted">{t('nav.chats')}</div>
      <div className="-mx-1 flex-1 overflow-y-auto px-1">
        {sessionsLoading && sessions.length === 0 ? (
          <div className="flex flex-col gap-1.5 px-1 pt-1">
            {[0, 1, 2].map((i) => <div key={i} className="h-8 animate-pulse rounded-xl bg-default/60" />)}
          </div>
        ) : sessions.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted">{t('nav.noChats')}</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {sessions.map((s) => <SessionRow key={s.id} session={s} active={s.id === activeId} />)}
          </div>
        )}
      </div>

      <UserMenu />
    </div>
  );
}
