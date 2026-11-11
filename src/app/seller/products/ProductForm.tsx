'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type Product = { slug: string; title: string; description: string; price: number; stock: number; published: boolean };

export default function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setStatus('');
    try {
      const response = await fetch(product ? `/api/products/${encodeURIComponent(product.slug)}` : '/api/products', {
        method: product ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: data.get('title'), description: data.get('description'),
          price: Number(data.get('price')), stock: Number(data.get('stock')),
          ...(product ? { expectedStock: product.stock } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Save failed.');
      if (!product) form.reset();
      setStatus(product ? 'Listing updated.' : 'Draft created. It awaits admin publication.');
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border bg-white p-4">
      <h2 className="font-bold">{product ? (product.published ? 'Published listing' : 'Draft listing') : 'New listing'}</h2>
      <label>Title<input name="title" defaultValue={product?.title} required minLength={3} maxLength={150} className="block w-full rounded-xl border p-2" /></label>
      <label>Description<textarea name="description" defaultValue={product?.description} required minLength={12} maxLength={5000} className="block w-full rounded-xl border p-2" /></label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label>Price (₦)<input name="price" type="number" required min="0.01" max="9999999999.99" step="0.01" defaultValue={product?.price} className="block w-full rounded-xl border p-2" /></label>
        <label>Available stock<input name="stock" type="number" required min="0" max="1000000" step="1" defaultValue={product?.stock ?? 0} className="block w-full rounded-xl border p-2" /></label>
      </div>
      <button disabled={busy} className="justify-self-start rounded-full bg-emerald-800 px-4 py-2 font-bold text-white">{product ? 'Save listing' : 'Create draft'}</button>
      {status && <p role="status">{status}</p>}
    </form>
  );
}
