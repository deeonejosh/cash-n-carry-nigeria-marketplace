'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ReturnReview({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function update(next: string) {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch('/api/returns', {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, status: next }),
      });
      if (!response.ok) throw new Error('Return review failed');
      router.refresh();
    } catch { setError(true); } finally { setBusy(false); }
  }
  return (
    <div className="flex flex-wrap gap-3 text-sm font-bold text-emerald-800">
      {status === 'REQUESTED' && <>
        <button disabled={busy} onClick={() => update('APPROVED')}>Approve return</button>
        <button disabled={busy} onClick={() => update('REJECTED')}>Reject return</button>
      </>}
      {status === 'APPROVED' && <button disabled={busy} onClick={() => update('RECEIVED')}>Mark received</button>}
      {error && <p role="alert">Unable to update return.</p>}
    </div>
  );
}
