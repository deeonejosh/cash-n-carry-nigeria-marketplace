'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function StartLive() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const response = await fetch('/api/live', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'start', title: new FormData(event.currentTarget).get('title') }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      router.push(`/live/${result.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to start stream.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={start} className="grid gap-3 rounded-2xl border bg-white p-4">
      <label>Stream title<input name="title" required minLength={3} maxLength={120} className="block w-full rounded-xl border p-2" /></label>
      <button disabled={busy} className="justify-self-start rounded-full bg-emerald-800 px-4 py-2 font-bold text-white">Start livestream</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
