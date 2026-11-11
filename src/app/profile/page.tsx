'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';

type Account = { name: string; email: string; role: string };

export default function ProfilePage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [registering, setRegistering] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (response) => {
        if (response.ok) setAccount((await response.json()).user);
        else if (response.status !== 401) setError('Unable to load your profile.');
      })
      .catch(() => setError('Unable to load your profile.'))
      .finally(() => setLoading(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setError('');
    setLoading(true);
    try {
      const response = await fetch(`/api/auth/${registering ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const result = await response.json();
      if (!response.ok) setError(result.error);
      else setAccount(result.user);
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/session-status', { method: 'DELETE' });
      if (!response.ok) throw new Error('Sign out failed');
      setAccount(null);
    } catch {
      setError('Unable to sign out. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <section className="rounded-[30px] bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <h1 className="text-2xl font-black text-slate-900">{account?.name ?? 'Your profile'}</h1>
        {account ? (
          <>
            <p className="mt-2 text-sm text-slate-500">{account.email} · {account.role.toLowerCase()}</p>
            <nav className="mt-4 flex flex-wrap gap-4 font-bold text-emerald-800">
              <Link href="/orders">Orders</Link>
              <Link href="/notifications">Notifications</Link>
              <Link href="/coins">Coins</Link>
              {account.role === 'BUYER' && <><Link href="/wishlist">Wishlist</Link><Link href="/addresses">Addresses</Link></>}
            </nav>
            <button disabled={loading} onClick={signOut} className="mt-5 rounded-full bg-emerald-800 px-5 py-2 font-bold text-white">Sign out</button>
          </>
        ) : (
          <form onSubmit={submit} className="mt-5 grid max-w-sm gap-4">
            {registering && <label>Name<input name="name" required minLength={2} autoComplete="name" className="block w-full rounded-xl border p-2" /></label>}
            <label>Email<input name="email" required type="email" autoComplete="email" className="block w-full rounded-xl border p-2" /></label>
            <label>Password<input name="password" required type="password" minLength={8} autoComplete={registering ? 'new-password' : 'current-password'} className="block w-full rounded-xl border p-2" /></label>
            <button disabled={loading} className="rounded-full bg-emerald-800 px-5 py-2 font-bold text-white">{registering ? 'Create account' : 'Sign in'}</button>
            <button type="button" disabled={loading} onClick={() => { setRegistering(!registering); setError(''); }} className="text-sm font-bold text-emerald-800">{registering ? 'Already have an account? Sign in' : 'Create a buyer account'}</button>
          </form>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      </section>
    </div>
  );
}
