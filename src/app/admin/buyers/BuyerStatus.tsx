'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BuyerStatus({ id, active }: { id: string; active: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const router = useRouter();

  async function update() {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch('/api/admin/buyers', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, active: !active }),
      });
      if (!response.ok) throw new Error('Update failed');
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button disabled={busy} onClick={update} className="rounded-full bg-emerald-800 px-4 py-2 text-sm font-bold text-white">{active ? 'Suspend buyer' : 'Reactivate buyer'}</button>
      {error && <p role="alert">Unable to update buyer status.</p>}
    </div>
  );
}
