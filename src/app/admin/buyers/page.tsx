import { notFound } from 'next/navigation';
import { getPageUser } from '@/lib/page-auth';
import { prisma } from '@/lib/prisma';
import BuyerStatus from './BuyerStatus';

export default async function AdminBuyers({ searchParams: input }: { searchParams: Promise<{ q?: string }> }) {
  const searchParams = await input;
  if ((await getPageUser())?.role !== 'ADMIN') notFound();
  const query = typeof searchParams.q === 'string' ? searchParams.q.trim().slice(0, 100) : '';
  const buyers = await prisma.user.findMany({
    where: { role: 'BUYER', ...(query ? { OR: [{ name: { contains: query, mode: 'insensitive' } }, { email: { contains: query, mode: 'insensitive' } }] } : {}) },
    select: { id: true, name: true, email: true, isActive: true }, orderBy: { createdAt: 'desc' }, take: 50,
  });

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <h1 className="text-3xl font-black text-emerald-950">Manage buyers</h1>
      <form className="flex gap-2">
        <input name="q" aria-label="Find buyer" defaultValue={query} maxLength={100} className="min-w-0 flex-1 rounded-xl border p-2" />
        <button className="font-bold text-emerald-800">Search</button>
      </form>
      {buyers.length === 0 && <p>No matching buyers.</p>}
      {buyers.map((buyer) => (
        <article key={buyer.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-4">
          <div><h2 className="font-bold">{buyer.name}</h2><p>{buyer.email} · {buyer.isActive ? 'Active' : 'Suspended'}</p></div>
          <BuyerStatus id={buyer.id} active={buyer.isActive} />
        </article>
      ))}
    </main>
  );
}
