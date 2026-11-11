'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function MarkRead({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function markRead() {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
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
    <>
      <button disabled={busy} onClick={markRead} className="text-sm font-bold text-emerald-800">Mark as read</button>
      {error && <p role="alert">Unable to update notification.</p>}
    </>
  );
}
