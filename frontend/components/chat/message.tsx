'use client';

import { useTranslations } from 'next-intl';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sources } from './sources';
import type { ChatMessage } from '@/lib/api';

export type Stage = 'searching' | 'generating' | null;

export interface UiMessage extends ChatMessage {
  key: string;
  streaming?: boolean;
  stage?: Stage;
  error?: boolean;
}

/** Strip the "[Эх сурвалж: …]" tail the engine appends — chips show it instead. */
function withoutSourceTail(text: string): string {
  return text.replace(/\s*\[Эх сурвалж:[^\]]*\]\s*$/u, '').trimEnd();
}

function Dots() {
  return (
    <span className="inline-flex gap-1 align-middle">
      <span className="dot size-1.5 rounded-full bg-muted" />
      <span className="dot size-1.5 rounded-full bg-muted" />
      <span className="dot size-1.5 rounded-full bg-muted" />
    </span>
  );
}

export function Message({ message }: { message: UiMessage }) {
  const t = useTranslations('chat');

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-br-lg bg-default px-4 py-2.5 text-[15px] leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  const showStage = message.streaming && message.content.length === 0 && message.stage;
  return (
    <div className="flex flex-col">
      {showStage ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Dots /> {message.stage === 'searching' ? t('searching') : t('generating')}
        </p>
      ) : message.refused && !message.streaming ? (
        <p className="text-[15px] italic text-muted">{t('refused')}</p>
      ) : message.error ? (
        <p className="text-[15px] text-danger">{message.content || t('error')}</p>
      ) : (
        <div className="md text-[15px]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{withoutSourceTail(message.content)}</ReactMarkdown>
          {message.streaming && <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-foreground align-text-bottom" />}
        </div>
      )}
      {!message.streaming && !message.refused && !message.error && (
        <Sources citations={message.citations ?? []} sources={message.sources ?? []} />
      )}
    </div>
  );
}
