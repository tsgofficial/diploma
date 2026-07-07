'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSession, sendMessage } from '@/lib/api';
import { clearToken, isAuthenticated } from '@/lib/auth';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
}

export default function ChatInterface() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Require auth; then bootstrap a conversation session on first render.
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    createSession()
      .then(setSessionId)
      .catch(() =>
        setMessages([
          { role: 'assistant', content: '⚠️ Could not reach the server.' },
        ])
      );
  }, [router]);

  // Keep the newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading || !sessionId) return;

    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setInput('');
    setLoading(true);

    try {
      const reply = await sendMessage(sessionId, question);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: reply.answer, sources: reply.sources },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '⚠️ Something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    clearToken();
    router.replace('/login');
  }

  return (
    <div className="mx-auto flex h-screen max-w-2xl flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <span className="text-sm font-medium">University Policy Assistant</span>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Sign out
        </button>
      </div>

      {/* Message list */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && !loading && (
          <p className="mt-8 text-center text-sm text-gray-400">
            Ask about school policies, rules, or documents.
          </p>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {m.content}
              {/* Show cited sources under assistant answers, when present. */}
              {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                <div className="mt-2 border-t border-gray-200 pt-2 text-xs text-gray-500">
                  Эх сурвалж: {m.sources.join(', ')}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-gray-100 px-4 py-2 text-sm text-gray-500">
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t p-4">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about school policies…"
            disabled={!sessionId}
            className="flex-1 rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim() || !sessionId}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
