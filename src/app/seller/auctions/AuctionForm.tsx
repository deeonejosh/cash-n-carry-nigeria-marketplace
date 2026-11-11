'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function AuctionForm({ products }: { products: { id: string; title: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auctions', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          productId: form.get('product'),
          startingBidKobo: Math.round(Number(form.get('startingBid')) * 100),
          durationMinutes: Number(form.get('duration')),
        }),
      });
      if (!response.ok) throw new Error('Unable to create auction. Check available stock.');
      router.push('/auctions');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to create auction.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={create} className="grid gap-3 rounded-2xl border bg-white p-4">
      <label>Product<select name="product" className="block w-full rounded-xl border p-2">{products.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}</select></label>
      <label>Starting bid (₦)<input name="startingBid" type="number" min="0.01" step="0.01" required className="block w-full rounded-xl border p-2" /></label>
      <label>Duration (minutes)<input name="duration" type="number" min="1" max="10080" required className="block w-full rounded-xl border p-2" /></label>
      <button disabled={busy} className="justify-self-start rounded-full bg-emerald-800 px-4 py-2 font-bold text-white">Create auction</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
