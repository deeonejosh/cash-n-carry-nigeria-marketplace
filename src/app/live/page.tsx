import Link from 'next/link';
import { getPageUser } from '@/lib/page-auth';
import { prisma } from '@/lib/prisma';
import StartLive from './StartLive';

export default async function LivePage() {
  const user = await getPageUser();
  const streams = await prisma.liveStream.findMany({
    where: { status: 'LIVE', seller: { status: 'VERIFIED' } },
    select: { id: true, title: true, seller: { select: { storefrontName: true } } },
    orderBy: { startsAt: 'desc' }, take: 30,
  });
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <h1 className="text-3xl font-black text-emerald-950">Live shopping</h1>
      {user?.role === 'SELLER' && <StartLive />}
      {!user && <Link href="/profile" className="font-bold text-emerald-800">Sign in to watch or broadcast</Link>}
      {!streams.length && <p>No active streams.</p>}
      {streams.map((stream) => (
        <article key={stream.id} className="rounded-2xl border bg-white p-4">
          <Link href={`/live/${stream.id}`} className="font-bold text-emerald-800">{stream.title}</Link>
          <p>{stream.seller.storefrontName}</p>
        </article>
      ))}
    </main>
  );
}
