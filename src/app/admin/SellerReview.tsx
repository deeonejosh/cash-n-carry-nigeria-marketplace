'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SellerReview({ sellerId, reviewedSubmission }: { sellerId: string; reviewedSubmission?: string }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function review(status: 'APPROVED' | 'REJECTED') {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/sellers', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sellerId, status, reviewedSubmission }),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? 'Review failed');
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to save seller review.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-x-2">
      <button disabled={busy || !reviewedSubmission} onClick={() => review('APPROVED')} className="rounded-full bg-emerald-800 px-3 py-1.5 font-bold text-white">Approve</button>
      <button disabled={busy} onClick={() => review('REJECTED')} className="rounded-full border px-3 py-1.5 font-bold">Reject</button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
