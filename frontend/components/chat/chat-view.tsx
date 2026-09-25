'use client';

import { toast } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Composer } from './composer';
import { Message, type UiMessage } from './message';
import { useShell } from '../shell-context';
import { ApiError, sessionApi, streamChat } from '@/lib/api';

let counter = 0;
const nextKey = () => `m${++counter}`;

/**
 * One conversation. With no `sessionId` it is a fresh chat: the session is
 * created on the first send and the URL swapped to /chat/<id> without a
 * navigation, so the streamed answer isn't interrupted.
 */
export function ChatView({ sessionId: initialId }: { sessionId?: string }) {
  const t = useTranslations('chat');
  const router = useRouter();
  const { upsertSession, sessions } = useShell();
  const [sessionId, setSessionId] = useState<string | undefined>(initialId);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [loading, setLoading] = useState(Boolean(initialId));
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load the transcript for an existing conversation.
  useEffect(() => {
    if (!initialId) return;
    let cancelled = false;
    setLoading(true);
    sessionApi
      .messages(initialId)
      .then((data) => {
        if (cancelled) return;
        setMessages(
          data.messages.map((m) => ({
            ...m,
            key: nextKey(),
            refused: m.role === 'assistant' && m.sources.length === 0 && m.citations.length === 0 && /олдсонгүй/i.test(m.content),
          }))
        );
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) router.replace('/chat');
        else toast.danger(t('error'));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [initialId, router, t]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const patchLast = useCallback((fn: (m: UiMessage) => UiMessage) => {
    setMessages((prev) => (prev.length === 0 ? prev : [...prev.slice(0, -1), fn(prev[prev.length - 1])]));
  }, []);

  async function send(question: string) {
    if (busy) return;
    setBusy(true);

    let id = sessionId;
    try {
      if (!id) {
        const created = await sessionApi.create();
        id = created.id;
        setSessionId(id);
        window.history.replaceState(null, '', `/chat/${id}`);
        upsertSession({ id, title: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      }
    } catch {
      toast.danger(t('error'));
      setBusy(false);
      return;
    }

    setMessages((prev) => [
      ...prev,
      { key: nextKey(), role: 'user', content: question, sources: [], citations: [] },
      { key: nextKey(), role: 'assistant', content: '', sources: [], citations: [], streaming: true, stage: 'searching' },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      for await (const event of streamChat(id, question, controller.signal)) {
        switch (event.type) {
          case 'status':
            patchLast((m) => ({ ...m, stage: event.stage }));
            break;
          case 'sources':
            patchLast((m) => ({ ...m, sources: event.sources, citations: event.citations, refused: event.refused }));
            break;
          case 'delta':
            patchLast((m) => ({ ...m, content: m.content + event.text, stage: null }));
            break;
          case 'done':
            patchLast((m) => ({ ...m, content: event.answer || m.content, refused: event.refused, streaming: false, stage: null }));
            break;
          case 'saved': {
            patchLast((m) => ({ ...m, id: event.messageId }));
            const existing = sessions.find((s) => s.id === id);
            upsertSession({
              id,
              title: event.sessionTitle ?? existing?.title ?? null,
              createdAt: existing?.createdAt ?? new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            break;
          }
          case 'error':
            patchLast((m) => ({ ...m, content: event.message, error: true, streaming: false, stage: null }));
            break;
        }
      }
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      patchLast((m) =>
        aborted
          ? { ...m, streaming: false, stage: null, error: m.content.length === 0, content: m.content }
          : { ...m, content: err instanceof ApiError ? err.message : t('error'), error: true, streaming: false, stage: null }
      );
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  const suggestions = t.raw('suggestions') as string[];
  const empty = !loading && messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {empty ? (
          <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{t('greeting')}</h1>
              <p className="mt-2 text-sm text-muted">{t('greetingSub')}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-2xl border border-separator bg-surface px-3.5 py-2 text-left text-sm text-foreground/90 transition-colors hover:bg-default">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
            {loading && (
              <div className="flex flex-col gap-4">
                <div className="ml-auto h-10 w-2/5 animate-pulse rounded-3xl bg-default/70" />
                <div className="h-24 w-4/5 animate-pulse rounded-2xl bg-default/50" />
              </div>
            )}
            {messages.map((m) => <Message key={m.key} message={m} />)}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
      <Composer onSend={send} onStop={() => abortRef.current?.abort()} busy={busy} autoFocus />
    </div>
  );
}
