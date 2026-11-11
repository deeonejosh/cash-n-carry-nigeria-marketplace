'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { currency } from '@/lib/data';

type CartItem = { productId: string; quantity: number; product: { title: string; price: string } };

async function post(path: string, data: unknown) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Request failed.');
  return result;
}

export default function CartPage() {
  const [items, setItems] = useState<CartItem[] | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<{ id: string; total: string } | null>(null);
  const [addresses, setAddresses] = useState<{ id: string; label: string; address: string }[]>([]);
  const [shippingAddress, setShippingAddress] = useState('');
  const checkoutKey = useRef<string | null>(null);
  const total = items?.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0) ?? 0;

  useEffect(() => {
    fetch('/api/addresses')
      .then(async (response) => { if (response.ok) setAddresses((await response.json()).addresses); })
      .catch(() => {});
    fetch('/api/cart')
      .then(async (response) => {
        if (response.status === 401) setSignedOut(true);
        else if (!response.ok) throw new Error('Cart unavailable');
        else setItems((await response.json()).cart.items);
      })
      .catch(() => setError('Unable to load your cart.'));
  }, []);

  async function remove(productId: string) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/cart?productId=${encodeURIComponent(productId)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Unable to remove item');
      setItems((current) => current?.filter((item) => item.productId !== productId) ?? null);
    } catch {
      setError('Unable to remove that item.');
    } finally {
      setBusy(false);
    }
  }

  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      let pending = order;
      if (!pending) {
        const result = await post('/api/orders', {
          checkoutKey: checkoutKey.current ??= crypto.randomUUID(),
          shippingAddress: form.get('shippingAddress'),
          items: items?.map(({ productId, quantity }) => ({ productId, quantity })),
        });
        pending = { id: result.order.id, total: result.order.total };
        setOrder(pending);
      }
      const payment = await post('/api/payments/initialize', { orderId: pending.id, provider: form.get('provider') });
      if (!payment.checkoutUrl) throw new Error('Payment provider did not return a checkout link.');
      window.location.assign(payment.checkoutUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to start checkout.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 md:px-8 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-black text-slate-900">Your cart</h1>
        <div className="mt-6 space-y-4">
          {signedOut && <Link href="/profile" className="font-bold text-emerald-800">Sign in as a buyer to view your cart</Link>}
          {!signedOut && !error && items === null && <p role="status">Loading cart…</p>}
          {items?.length === 0 && <Link href="/shop" className="font-bold text-emerald-800">Your cart is empty. Browse the shop</Link>}
          {items?.map((item) => (
            <div key={item.productId} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
              <div><p className="font-bold">{item.product.title}</p><p className="text-sm">Quantity {item.quantity}</p></div>
              <span className="font-black">{currency(Number(item.product.price) * item.quantity)}</span>
              <button disabled={busy || !!order} onClick={() => remove(item.productId)} className="text-sm font-bold text-emerald-800">Remove</button>
            </div>
          ))}
        </div>
      </section>
      <aside className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black text-slate-900">Order summary</h2>
        <p className="mt-3 font-bold">{currency(order ? Number(order.total) : total)}</p>
        {!!items?.length && (
          <form onSubmit={checkout} className="mt-5 grid gap-4">
            {order ? <p className="text-sm">Pending order {order.id}</p> : (
              <>
                {addresses.length > 0 && (
                  <label className="text-sm font-semibold">Saved address
                    <select defaultValue="" onChange={(event) => setShippingAddress(event.target.value)} className="mt-1 block w-full rounded-xl border p-2">
                      <option value="">Enter an address</option>
                      {addresses.map((address) => <option key={address.id} value={address.address}>{address.label}</option>)}
                    </select>
                  </label>
                )}
                <label className="text-sm font-semibold">Shipping address
                  <textarea name="shippingAddress" value={shippingAddress} onChange={(event) => setShippingAddress(event.target.value)} required minLength={8} maxLength={1000} className="mt-1 block w-full rounded-xl border p-2" />
                </label>
              </>
            )}
            <label className="text-sm font-semibold">Test payment provider
              <select name="provider" className="mt-1 block w-full rounded-xl border p-2">
                <option value="paystack">Paystack</option>
                <option value="flutterwave">Flutterwave</option>
              </select>
            </label>
            <button disabled={busy} className="rounded-full bg-emerald-800 px-5 py-3 text-sm font-black text-white disabled:opacity-50">
              {busy ? 'Processing…' : order ? 'Retry test payment' : 'Proceed to test checkout'}
            </button>
          </form>
        )}
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      </aside>
    </div>
  );
}
