'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function UpdateShipment({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const input = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch('/api/shipments', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, status, ...input }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to update shipment.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={update} className="flex flex-wrap items-end gap-3">
      {status === 'SHIPPED' && <>
        <label>Carrier<input name="carrier" required maxLength={100} className="block rounded-lg border p-2" /></label>
        <label>Tracking reference<input name="trackingRef" required maxLength={120} className="block rounded-lg border p-2" /></label>
      </>}
      <button disabled={busy} className="rounded-full bg-emerald-800 px-4 py-2 font-bold text-white">Mark as {status.toLowerCase()}</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
