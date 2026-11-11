'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { currency } from '@/lib/data';

type Deal = { id: string; slug: string; title: string; price: string; dealPrice: string; dealEndsAt: string; dealRemaining: number; stock: number };

export default function FlashDeals() {
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => {
      void fetch('/api/flash-deals').then(async (response) => {
        if (!response.ok) throw new Error('Deals unavailable');
        setDeals((await response.json()).deals);
        setError(false);
      }).catch(() => setError(true));
    };
    refresh();
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    const data = window.setInterval(refresh, 15000);
    return () => { window.clearInterval(clock); window.clearInterval(data); };
  }, []);
  const active = deals?.filter((deal) => new Date(deal.dealEndsAt).getTime() > now);
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <h1 className="text-3xl font-black text-emerald-950">Flash deals</h1>
      {error && <p role="alert">Unable to load deals.</p>}
      {active?.length === 0 && <p>No flash deals are active.</p>}
      {active?.map((deal) => {
        const seconds = Math.ceil((new Date(deal.dealEndsAt).getTime() - now) / 1000);
        return (
          <article key={deal.id} className="space-y-2 rounded-2xl border bg-white p-4">
            <Link href={`/products/${deal.slug}`} className="font-bold text-emerald-800">{deal.title}</Link>
            <p><strong className="text-orange-700">{currency(Number(deal.dealPrice))}</strong> <del>{currency(Number(deal.price))}</del></p>
            <p>{Math.min(deal.dealRemaining, deal.stock)} available · {Math.floor(seconds / 3600)}h {Math.floor(seconds / 60) % 60}m {seconds % 60}s left</p>
          </article>
        );
      })}
    </main>
  );
}
