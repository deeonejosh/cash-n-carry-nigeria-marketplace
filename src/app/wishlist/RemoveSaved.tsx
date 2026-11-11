'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RemoveSaved({ productId }: { productId: string }) {
  const router = useRouter();
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  async function remove() {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch(`/api/wishlist?productId=${encodeURIComponent(productId)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Remove failed');
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button disabled={busy} onClick={remove} className="mt-2 text-sm font-bold text-emerald-800">Remove from wishlist</button>
      {error && <p role="alert">Unable to remove product.</p>}
    </>
  );
}
