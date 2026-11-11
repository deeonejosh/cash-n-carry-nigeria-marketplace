'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

type Auction = {
  id: string; title: string; storefrontName: string; startingBid: string; currentBid: string | null;
  endsAt: string; closedAt: string | null; releasedAt: string | null; own: boolean; winning: boolean; orderId: string | null;
};

export default function AuctionsPage() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch('/api/auctions', { cache: 'no-store' });
    if (!response.ok) throw new Error('Auctions unavailable.');
    setAuctions((await response.json()).auctions);
  }, []);

  useEffect(() => {
    const refresh = () => { void load().catch(() => setStatus('Unable to load auctions.')); };
    refresh();
    const poll = window.setInterval(refresh, 3000);
    return () => window.clearInterval(poll);
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>, auction: Auction, action: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setStatus('');
    try {
      const response = await fetch('/api/auctions', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: auction.id, action,
          ...(action === 'bid' ? { amountKobo: Math.round(Number(data.get('bid')) * 100) } : {}),
          ...(action === 'checkout' ? { shippingAddress: data.get('shippingAddress') } : {}),
        }),
      });
      if (!response.ok) throw new Error(response.status === 401 ? 'Sign in to continue.' : 'Action unavailable. Check the latest auction details.');
      await load();
      setStatus(action === 'bid' ? 'Bid recorded.' : 'Auction updated.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <h1 className="text-3xl font-black text-emerald-950">Auctions</h1>
      <Link href="/seller/auctions" className="font-bold text-emerald-800">Create an auction</Link>
      {status && <p role="status">{status}</p>}
      {!auctions.length && <p>No auctions listed.</p>}
      {auctions.map((auction) => {
        const ended = !!auction.closedAt || new Date(auction.endsAt).getTime() <= Date.now();
        return (
          <article key={auction.id} id={auction.id} className="space-y-2 rounded-2xl border bg-white p-4">
            <h2 className="font-bold">{auction.title}</h2>
            <p>{auction.storefrontName} · ₦{auction.currentBid ?? auction.startingBid}</p>
            <p>{ended ? 'Ended' : `Ends ${new Date(auction.endsAt).toLocaleString()}`}</p>
            {!ended && !auction.own && (
              <form onSubmit={(event) => submit(event, auction, 'bid')} className="flex flex-wrap items-center gap-2">
                <label>Bid (₦)<input name="bid" type="number" required min="0.01" step="0.01" className="ml-2 rounded-xl border p-2" /></label>
                <button disabled={busy} className="font-bold text-emerald-800">Place bid</button>
              </form>
            )}
            {ended && auction.own && !auction.closedAt && (
              <form onSubmit={(event) => submit(event, auction, 'close')}><button disabled={busy} className="font-bold text-emerald-800">Close auction</button></form>
            )}
            {ended && auction.winning && !auction.releasedAt && (auction.orderId ? <Link href="/orders" className="font-bold text-emerald-800">View winning order</Link> : (
              <form onSubmit={(event) => submit(event, auction, 'checkout')} className="space-y-2">
                <label>Shipping address<textarea name="shippingAddress" minLength={8} maxLength={1000} required className="block w-full rounded-xl border p-2" /></label>
                <button disabled={busy} className="font-bold text-emerald-800">Create winning order</button>
              </form>
            ))}
          </article>
        );
      })}
    </main>
  );
}
