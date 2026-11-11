'use client';

import { useState, type FormEvent } from 'react';

export default function ScheduleDeal({ products }: { products: { id: string; title: string; stock: number }[] }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setStatus('');
    try {
      const response = await fetch('/api/flash-deals', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          productId: data.get('product'), priceKobo: Math.round(Number(data.get('price')) * 100), stock: Number(data.get('stock')),
          startsAt: new Date(String(data.get('starts'))).toISOString(), endsAt: new Date(String(data.get('ends'))).toISOString(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setStatus('Flash deal scheduled.');
      form.reset();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to schedule deal.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border bg-white p-4">
      <label>Product<select name="product" className="block w-full rounded-xl border p-2">{products.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.stock} available</option>)}</select></label>
      <label>Deal price (₦)<input name="price" type="number" required min="0.01" step="0.01" className="block w-full rounded-xl border p-2" /></label>
      <label>Maximum deal quantity<input name="stock" type="number" required min="1" max="1000000" className="block w-full rounded-xl border p-2" /></label>
      <label>Start (local time)<input name="starts" type="datetime-local" required className="block w-full rounded-xl border p-2" /></label>
      <label>End (local time)<input name="ends" type="datetime-local" required className="block w-full rounded-xl border p-2" /></label>
      <button disabled={busy} className="justify-self-start rounded-full bg-emerald-800 px-4 py-2 font-bold text-white">Schedule deal</button>
      {status && <p role="status">{status}</p>}
    </form>
  );
}
