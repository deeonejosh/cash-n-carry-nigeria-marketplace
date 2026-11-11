'use client';

import { useState, type FormEvent } from 'react';

type Props = { threadId: string; onSent: () => void } | { receiverId: string };

export default function MessageForm(props: Props) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const target = 'threadId' in props ? { threadId: props.threadId } : { receiverId: props.receiverId };
    setBusy(true);
    setStatus('');
    try {
      const response = await fetch('/api/messages', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...target, text: new FormData(form).get('text') }),
      });
      if (!response.ok) throw new Error('Send failed');
      form.reset();
      setStatus('Message sent.');
      if ('onSent' in props) props.onSent();
    } catch {
      setStatus('Unable to send message.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid max-w-md gap-2" onSubmit={send}>
      <label className="text-sm font-bold">
        {'threadId' in props ? 'Reply' : 'Message seller'}
        <textarea name="text" required maxLength={2000} className="block w-full rounded-xl border bg-white p-2 font-normal" />
      </label>
      <button disabled={busy} className="justify-self-start rounded-full bg-emerald-800 px-4 py-2 text-sm font-bold text-white">Send message</button>
      {status && <p role="status" className="text-sm">{status}</p>}
    </form>
  );
}
