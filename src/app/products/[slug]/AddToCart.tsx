'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function AddToCart({ productId, inStock }: { productId: string; inStock: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function save(to: 'cart' | 'wishlist') {
    setBusy(true);
    try {
      const response = await fetch(`/api/${to}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      setMessage(response.ok ? (to === 'cart' ? 'Added to cart.' : 'Saved to wishlist.') : response.status === 401 ? 'Sign in as a buyer to add products.' : 'Unable to add product.');
    } catch {
      setMessage('Unable to connect.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button disabled={busy || !inStock} onClick={() => save('cart')} className="rounded-full bg-emerald-800 px-5 py-3 text-sm font-black text-white disabled:opacity-50">
        {inStock ? 'Add to cart' : 'Out of stock'}
      </button>
      <Link href="/cart" className="ml-3 text-sm font-bold text-emerald-800">View cart</Link>
      <button disabled={busy} onClick={() => save('wishlist')} className="ml-3 text-sm font-bold text-emerald-800">Save to wishlist</button>
      <p role="status" className="mt-2 text-sm">{message}</p>
    </div>
  );
}
