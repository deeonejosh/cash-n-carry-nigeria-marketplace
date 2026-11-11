'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';

type Address = { id: string; label: string; address: string };

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [error, setError] = useState('');
  const [signedOut, setSignedOut] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/addresses').then(async (response) => {
      if (response.status === 401) setSignedOut(true);
      else if (!response.ok) throw new Error('Load failed');
      else setAddresses((await response.json()).addresses);
    }).catch(() => setError('Unable to load addresses.'));
  }, []);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/addresses', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      if (!response.ok) throw new Error('Save failed');
      const { address } = await response.json();
      setAddresses((current) => [address, ...(current ?? [])]);
      form.reset();
    } catch {
      setError('Unable to save address.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/addresses?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Delete failed');
      setAddresses((current) => current?.filter((address) => address.id !== id) ?? []);
    } catch {
      setError('Unable to remove address.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-3xl font-black text-emerald-950">Shipping addresses</h1>
      {signedOut && <Link href="/profile">Sign in as a buyer to manage addresses</Link>}
      {addresses?.map((item) => (
        <article key={item.id} className="rounded-2xl border bg-white p-4">
          <h2 className="font-bold">{item.label}</h2>
          <p className="whitespace-pre-wrap">{item.address}</p>
          <button disabled={busy} className="mt-2 text-sm font-bold text-emerald-800" onClick={() => remove(item.id)}>Remove address</button>
        </article>
      ))}
      {addresses && (
        <form onSubmit={add} className="grid max-w-md gap-3 rounded-2xl border bg-white p-4">
          <label>Address label<input name="label" required maxLength={60} className="block w-full rounded-xl border p-2" /></label>
          <label>Shipping address<textarea name="address" required minLength={8} maxLength={1000} className="block w-full rounded-xl border p-2" /></label>
          <button disabled={busy} className="rounded-full bg-emerald-800 p-2 font-bold text-white">Save address</button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
