'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OrderProgress({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function advance() {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch('/api/orders/status', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId: id, status }),
      });
      if (!response.ok) throw new Error('Status update failed');
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button disabled={busy} onClick={advance} className="rounded-full bg-emerald-800 px-4 py-2 text-sm font-bold text-white">Mark as {status.toLowerCase()}</button>
      {error && <p role="alert">Unable to update order.</p>}
    </>
  );
}
