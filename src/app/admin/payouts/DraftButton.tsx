'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DraftButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  async function prepare() {
    setBusy(true);
    setStatus('');
    try {
      const response = await fetch('/api/admin/payout-drafts', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ settlementId: id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setStatus('Draft recorded.');
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to prepare draft.');
    } finally { setBusy(false); }
  }
  return (
    <div className="space-y-2">
      <button disabled={busy} onClick={prepare} className="rounded-full bg-emerald-800 px-4 py-2 font-bold text-white">Prepare payout draft</button>
      {status && <p role="status">{status}</p>}
    </div>
  );
}
