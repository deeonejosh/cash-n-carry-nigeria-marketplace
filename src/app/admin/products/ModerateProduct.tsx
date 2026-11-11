'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ModerateProduct({ slug, published }: { slug: string; published: boolean }) {
  const router = useRouter();
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  async function moderate() {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(slug)}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ published: !published }),
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
      <button disabled={busy} onClick={moderate} className="rounded-full bg-emerald-800 px-4 py-2 text-sm font-bold text-white">{published ? 'Unpublish' : 'Publish'}</button>
      {error && <p role="alert">Unable to update publication.</p>}
    </div>
  );
}
