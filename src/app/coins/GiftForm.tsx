'use client';

import { useRef, useState, type FormEvent } from 'react';

const icons = { rose: '🌹', star: '⭐', lion: '🦁' } as const;

export default function GiftForm({ recipientId }: { recipientId: string }) {
  const [status, setStatus] = useState('');
  const [animation, setAnimation] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ gift: string; requestId: string } | null>(null);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const gift = new FormData(event.currentTarget).get('gift') as keyof typeof icons;
    if (pending.current?.gift !== gift) pending.current = { gift, requestId: crypto.randomUUID() };
    setAnimation('');
    setStatus('');
    setBusy(true);
    try {
      const response = await fetch('/api/coins', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'gift', recipientId, ...pending.current }),
      });
      if (!response.ok) {
        if (response.status < 500) pending.current = null;
        const result = await response.json();
        throw new Error(result.error ?? 'Unable to send gift.');
      }
      pending.current = null;
      setAnimation(icons[gift]);
      setStatus('Gift sent.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to send gift.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="flex flex-wrap items-center gap-3">
      <label>Gift
        <select name="gift" className="ml-2 rounded-xl border p-2">
          <option value="rose">Rose · 10 coins</option><option value="star">Star · 100 coins</option><option value="lion">Lion · 1,000 coins</option>
        </select>
      </label>
      <button disabled={busy} className="rounded-full bg-orange-600 px-4 py-2 text-sm font-bold text-white">Send gift</button>
      {animation && <span aria-hidden className="text-3xl motion-safe:animate-bounce">{animation}</span>}
      {status && <p role="status">{status}</p>}
    </form>
  );
}
