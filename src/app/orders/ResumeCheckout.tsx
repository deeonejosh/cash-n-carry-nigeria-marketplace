'use client';

import { useState, type FormEvent } from 'react';

export default function ResumeCheckout({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const provider = new FormData(event.currentTarget).get('provider');
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/payments/initialize', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId: id, provider }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Payment unavailable.');
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Payment unavailable.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={pay} className="flex flex-wrap items-center gap-3">
      <label>Test provider
        <select name="provider" className="ml-2 rounded-xl border p-2"><option value="paystack">Paystack</option><option value="flutterwave">Flutterwave</option></select>
      </label>
      <button disabled={busy} className="rounded-full bg-emerald-800 px-4 py-2 text-sm font-bold text-white">Continue to test payment</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
