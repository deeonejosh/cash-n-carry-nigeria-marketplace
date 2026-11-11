'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function ReturnForm({ itemId, max }: { itemId: string; max: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const pending = useRef<{ signature: string; id: string } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const quantity = Number(form.get('quantity'));
    const reason = String(form.get('reason')).trim();
    const signature = JSON.stringify([quantity, reason]);
    if (pending.current?.signature !== signature) pending.current = { signature, id: crypto.randomUUID() };
    setBusy(true);
    setStatus('');
    try {
      const response = await fetch('/api/returns', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId, quantity, reason, requestId: pending.current.id }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      setStatus('Return requested.');
      pending.current = null;
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to request a return.');
    } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <label>Quantity<input name="quantity" type="number" min="1" max={max} defaultValue="1" required className="block w-20 rounded-lg border p-2" /></label>
      <label>Reason<input name="reason" required minLength={5} maxLength={500} className="block rounded-lg border p-2" /></label>
      <button disabled={busy} className="rounded-full bg-emerald-800 px-4 py-2 font-bold text-white">Request return</button>
      {status && <p role="status">{status}</p>}
    </form>
  );
}
