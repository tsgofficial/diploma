'use client';

import { Button } from '@heroui/react';
import { ArrowUp, Square } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { KeyboardEvent, useEffect, useRef, useState } from 'react';

export function Composer({ onSend, onStop, busy, autoFocus }: { onSend: (text: string) => void; onStop: () => void; busy: boolean; autoFocus?: boolean }) {
  const t = useTranslations('chat');
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow up to the CSS max-height.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  function submit() {
    const text = value.trim();
    if (!text || busy) return;
    onSend(text);
    setValue('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4 pt-2">
      <div className="flex items-end gap-2 rounded-3xl border border-separator bg-surface p-2 pl-4 shadow-(--surface-shadow) focus-within:border-field-border-focus">
        <textarea
          ref={ref}
          rows={1}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('placeholder')}
          className="composer-input min-h-6 flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-6 outline-none placeholder:text-muted"
        />
        {busy ? (
          <Button variant="secondary" size="sm" isIconOnly aria-label="Stop" onPress={onStop} className="rounded-full">
            <Square className="size-4" />
          </Button>
        ) : (
          <Button variant="primary" size="sm" isIconOnly aria-label={t('send')} isDisabled={!value.trim()} onPress={submit} className="rounded-full">
            <ArrowUp className="size-4" />
          </Button>
        )}
      </div>
      <p className="mt-2 text-center text-[11px] text-muted">{t('hint')}</p>
    </div>
  );
}
