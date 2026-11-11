'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import MessageForm from './MessageForm';

type Thread = {
  id: string;
  messages: { id: string; text: string; senderId: string; receiverId: string | null; deliveredAt: string | null; sender: { name: string } }[];
};

export default function MessagesPage() {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [error, setError] = useState('');
  const [viewerId, setViewerId] = useState('');
  const [signedOut, setSignedOut] = useState(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/messages', { signal, cache: 'no-store' });
      if (response.status === 401) {
        setThreads(null);
        setSignedOut(true);
        return;
      }
      if (!response.ok) throw new Error('Inbox unavailable');
      const data: { threads: Thread[]; viewerId: string } = await response.json();
      setThreads(data.threads);
      setViewerId(data.viewerId);
      const unconfirmed = data.threads.flatMap((thread) => thread.messages)
        .filter((message) => message.receiverId === data.viewerId && !message.deliveredAt)
        .map((message) => message.id);
      for (let index = 0; index < unconfirmed.length; index += 100) {
        void fetch('/api/messages/receipts', {
          method: 'POST', headers: { 'content-type': 'application/json' }, signal,
          body: JSON.stringify({ ids: unconfirmed.slice(index, index + 100) }),
        }).catch(() => {});
      }
      setSignedOut(false);
      setError('');
    } catch {
      if (!signal?.aborted) setError('Unable to load messages.');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const stream = new EventSource('/api/events');
    const update = () => { void refresh(controller.signal); };
    stream.addEventListener('message', update);
    stream.addEventListener('receipt', update);
    stream.addEventListener('ready', update);
    const poll = window.setInterval(() => {
      if (stream.readyState !== EventSource.OPEN && document.visibilityState === 'visible') void refresh(controller.signal);
    }, 5000);
    return () => { controller.abort(); stream.close(); window.clearInterval(poll); };
  }, [refresh]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <section className="rounded-[30px] bg-gradient-to-r from-emerald-700 to-emerald-900 p-7 text-white shadow-soft">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-100">Messages</p>
        <h1 className="mt-2 text-3xl font-black md:text-5xl">Inbox</h1>
      </section>
      <div className="mt-6 space-y-3 rounded-[28px] border border-slate-100 bg-white p-4 shadow-sm">
        {signedOut && <Link className="font-bold text-emerald-800" href="/profile">Sign in to view your inbox</Link>}
        {error && <p role="alert">{error}</p>}
        {!signedOut && !error && threads === null && <p role="status">Loading messages…</p>}
        {threads?.length === 0 && <p>No messages yet.</p>}
        {threads?.map((thread) => (
          <article key={thread.id} aria-label="Conversation" className="space-y-2 rounded-2xl bg-slate-50 p-3">
            {[...thread.messages].reverse().map((message) => (
              <div key={message.id}>
                <p className="font-bold text-slate-900">{message.sender.name}</p>
                <p className="whitespace-pre-wrap text-sm text-slate-600">{message.text}</p>
                {message.senderId === viewerId && <p className="text-xs text-slate-500">{message.deliveredAt ? 'Delivered' : 'Sent'}</p>}
              </div>
            ))}
            <MessageForm threadId={thread.id} onSent={() => refresh()} />
          </article>
        ))}
      </div>
    </div>
  );
}
