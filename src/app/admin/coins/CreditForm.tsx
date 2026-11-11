'use client';

import { useRef, useState, type FormEvent } from 'react';

export default function CreditForm({ users }: { users: { id: string; name: string; email: string }[] }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ recipientId: string; coins: number; requestId: string } | null>(null);

  async function credit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const recipientId = String(data.get('user'));
    const coins = Number(data.get('coins'));
    if (pending.current?.recipientId !== recipientId || pending.current.coins !== coins) {
      pending.current = { recipientId, coins, requestId: crypto.randomUUID() };
    }
    setBusy(true);
    setStatus('');
    try {
      const response = await fetch('/api/coins', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'credit', ...pending.current }),
      });
      if (!response.ok) {
        if (response.status < 500) pending.current = null;
        throw new Error('Credit failed.');
      }
      pending.current = null;
      setStatus('Promotional coins credited.');
    } catch {
      setStatus('Unable to confirm credit.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={credit} className="grid gap-3 rounded-2xl border bg-white p-4">
      <label>User<select name="user" className="block w-full rounded-xl border p-2">{users.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}</select></label>
      <label>Coins<input name="coins" type="number" required min="1" max="10000" className="block w-full rounded-xl border p-2" /></label>
      <button disabled={busy || !users.length} className="justify-self-start rounded-full bg-emerald-800 px-4 py-2 font-bold text-white">Credit coins</button>
      {status && <p role="status">{status}</p>}
    </form>
  );
}
